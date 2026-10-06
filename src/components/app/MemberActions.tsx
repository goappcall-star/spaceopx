import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuickProfile } from "@/components/gamer/QuickProfile";
import { useProfileDialog } from "@/components/gamer/ProfileDialog";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalCall } from "@/hooks/use-call";
import { useVoice } from "@/hooks/use-voice";
import { useRelationship } from "@/hooks/use-social";
import { useServerRoles } from "@/hooks/use-server-admin";
import { blocksService, conversationsService, friendsService } from "@/services/social";
import { membersService } from "@/services/members";
import { serverAdminService, adminErrorMessage } from "@/services/server-admin";
import { roleLabel } from "@/services/roles";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SettingsMembers } from "@/components/server-settings/SettingsMembers";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import type { MemberWithProfile, Server } from "@/types";
import { memberAliasKey } from "@/lib/member-groups";
import { useServerChannels, useServerMembers } from "@/hooks/use-servers";
import { memberHasPermission } from "@/services/permissions";
import { hasPermission } from "@/lib/permissions";
import { requestVoiceMove } from "@/services/voice-moderation";

export function MemberActions({
  member,
  server,
  children,
  onStartDirect,
  onInvite,
  onAliasChange,
  canManageRoles,
  canManageMembers,
  canKick,
  canBan,
}: {
  member: MemberWithProfile;
  server: Server;
  children: ReactNode;
  onStartDirect?: ((id: string) => void) | undefined;
  onInvite?: (() => void) | undefined;
  onAliasChange: () => void;
  canManageRoles: boolean;
  canManageMembers: boolean;
  canKick: boolean;
  canBan: boolean;
}) {
  const { user } = useAuth(),
    call = useOptionalCall(),
    voice = useVoice(),
    query = useQueryClient();
  const { openProfile } = useProfileDialog();
  const { data: channels = [] } = useServerChannels(server.id);
  const { data: members = [] } = useServerMembers(server.id);
  const me = members.find((m) => m.user_id === user?.id);
  const canMove =
    memberHasPermission(me, server.owner_id, "manage_voice") || hasPermission(me, "move_members");
  const source = Object.entries(voice.participantsByChannel).find(([, people]) =>
    people.some((p) => p.user_id === member.user_id && p.voice_session_id),
  );
  const session = source?.[1].find((p) => p.user_id === member.user_id)?.voice_session_id;
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: relationship } = useRelationship(
    menuOpen && member.user_id !== user?.id ? member.user_id : null,
  );
  const { data: roles = [] } = useServerRoles(menuOpen ? server.id : null);
  const [editor, setEditor] = useState<"note" | "alias" | "nickname" | "moderation" | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"kick" | "ban" | null>(null);
  const self = member.user_id === user?.id,
    owner = member.user_id === server.owner_id;
  const name = member.nickname ?? member.profile?.display_name ?? "Usuário";
  const noteKey = `lobbyx:private-note:${user?.id}:${member.user_id}`;
  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      await Promise.all([
        query.invalidateQueries({ queryKey: ["members", server.id] }),
        query.invalidateQueries({ queryKey: ["relationship"] }),
        query.invalidateQueries({ queryKey: ["social"] }),
        query.invalidateQueries({ queryKey: ["friends"] }),
      ]);
      if (message) toast.success(message);
      return true;
    } catch (error) {
      toast.error(adminErrorMessage(error));
      return false;
    }
  }
  function edit(type: "note" | "alias" | "nickname") {
    try {
      setValue(
        type === "nickname"
          ? (member.nickname ?? "")
          : (localStorage.getItem(
              type === "note" ? noteKey : memberAliasKey(user?.id, member.user_id),
            ) ?? ""),
      );
      setEditor(type);
    } catch {
      toast.error("Não foi possível abrir essa opção.");
    }
  }
  return (
    <>
      <ContextMenu onOpenChange={setMenuOpen}>
        <ContextMenuTrigger asChild>
          <div>
            <QuickProfile
              userId={member.user_id}
              roles={member.roles}
              side="left"
              onStartDirect={onStartDirect}
            >
              {children}
            </QuickProfile>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64">
          {canMove && source && session && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>Mover para</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {channels
                  .filter((c) => c.type === "voice" && c.id !== source[0])
                  .map((c) => (
                    <ContextMenuItem
                      key={c.id}
                      onSelect={() =>
                        void run(
                          () => requestVoiceMove(member.user_id, source[0], c.id, session),
                          "Solicitação de movimentação enviada.",
                        )
                      }
                    >
                      {c.name}
                    </ContextMenuItem>
                  ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}
          <ContextMenuItem onSelect={() => openProfile(member.user_id)}>Perfil</ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              void run(
                () => navigator.clipboard.writeText(`@${member.profile?.username ?? name}`),
                "Menção copiada. Cole no chat.",
              )
            }
          >
            Mencionar
          </ContextMenuItem>
          {!self && (
            <>
              <ContextMenuItem
                disabled={!onStartDirect}
                onSelect={() =>
                  void run(async () => {
                    const id = await conversationsService.openDirect(member.user_id);
                    onStartDirect?.(id);
                  }, "Conversa aberta.")
                }
              >
                Mensagem
              </ContextMenuItem>
              <ContextMenuItem
                disabled={!call || !member.profile}
                onSelect={() =>
                  void run(
                    () =>
                      call!.startCall(
                        {
                          id: member.user_id,
                          display_name: name,
                          username: member.profile?.username ?? name,
                          avatar_url: member.profile?.avatar_url ?? null,
                        },
                        false,
                      ),
                    "",
                  )
                }
              >
                Iniciar chamada
              </ContextMenuItem>
            </>
          )}
          <ContextMenuItem onSelect={() => edit("note")}>
            Adicionar nota{" "}
            <span className="ml-auto text-[10px] text-muted-foreground">Só para você</span>
          </ContextMenuItem>
          {!self && (
            <ContextMenuItem onSelect={() => edit("alias")}>
              Adicionar apelido de amigo
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          {(self || (canManageMembers && !owner)) && (
            <ContextMenuItem onSelect={() => edit("nickname")}>Alterar apelido</ContextMenuItem>
          )}
          {onInvite && (
            <ContextMenuItem onSelect={onInvite}>Convidar para o servidor</ContextMenuItem>
          )}
          {!self && (
            <>
              {relationship?.state === "friends" ? (
                <ContextMenuItem
                  onSelect={() =>
                    void run(
                      () => friendsService.respond(relationship.friendshipId!, "remove"),
                      "Amizade desfeita.",
                    )
                  }
                >
                  Desfazer amizade
                </ContextMenuItem>
              ) : (
                <ContextMenuItem
                  disabled={relationship?.state !== "none"}
                  onSelect={() =>
                    void run(
                      () => friendsService.sendRequest(member.user_id),
                      "Solicitação enviada.",
                    )
                  }
                >
                  {relationship?.state === "request_sent"
                    ? "Solicitação enviada"
                    : "Adicionar amigo"}
                </ContextMenuItem>
              )}
              <ContextMenuCheckboxItem
                checked={
                  (voice.volumes[member.user_id] ?? 100) === 0 &&
                  Boolean(voice.hiddenVideos[member.user_id])
                }
                onCheckedChange={(checked) => {
                  voice.setUserVolume(member.user_id, checked ? 0 : 100);
                  voice.setVideoHidden(member.user_id, checked);
                }}
              >
                Ignorar nesta chamada
              </ContextMenuCheckboxItem>
              <ContextMenuItem
                className="text-destructive"
                onSelect={() =>
                  void run(() => blocksService.block(member.user_id), "Usuário bloqueado.")
                }
              >
                Bloquear
              </ContextMenuItem>
            </>
          )}
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>Cargos</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {canManageRoles && !owner
                ? roles
                    .filter((role) => role.name !== "OWNER")
                    .map((role) => (
                      <ContextMenuCheckboxItem
                        key={role.id}
                        checked={member.roles.some((r) => r.id === role.id)}
                        onCheckedChange={(checked) => {
                          const current = member.roles.map((r) => r.id);
                          void run(
                            () =>
                              serverAdminService.setMemberRoles(
                                member.id,
                                checked
                                  ? [...current, role.id]
                                  : current.filter((id) => id !== role.id),
                                current,
                              ),
                            "Cargos atualizados.",
                          );
                        }}
                      >
                        <span style={{ color: role.color }}>●</span> {roleLabel(role.name)}
                      </ContextMenuCheckboxItem>
                    ))
                : member.roles.map((role) => (
                    <ContextMenuItem disabled key={role.id}>
                      {roleLabel(role.name)}
                    </ContextMenuItem>
                  ))}
              {!member.roles.length && !canManageRoles && (
                <ContextMenuItem disabled>Sem cargos</ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
          {(canManageRoles || canKick || canBan) && (
            <ContextMenuItem onSelect={() => setEditor("moderation")}>
              Abrir na visualização de moderador
            </ContextMenuItem>
          )}
          {!self && !owner && canKick && (
            <ContextMenuItem className="text-destructive" onSelect={() => setConfirmation("kick")}>
              Expulsar {name}
            </ContextMenuItem>
          )}
          {!self && !owner && canBan && (
            <ContextMenuItem className="text-destructive" onSelect={() => setConfirmation("ban")}>
              Banir {name}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() =>
              void run(() => navigator.clipboard.writeText(member.user_id), "ID copiado.")
            }
          >
            Copiar ID do usuário
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {confirmation && (
        <ConfirmActionDialog
          title={`${confirmation === "ban" ? "Banir" : "Expulsar"} ${name}?`}
          description={
            confirmation === "ban"
              ? "O membro será removido e não poderá retornar até o banimento ser revogado."
              : "O membro será removido deste servidor."
          }
          label={confirmation === "ban" ? "Banir membro" : "Expulsar membro"}
          onClose={() => setConfirmation(null)}
          onConfirm={() =>
            run(
              () =>
                confirmation === "ban"
                  ? serverAdminService.banMember(server.id, member.user_id, null, user!.id)
                  : serverAdminService.kickMember(member.id),
              "Moderação aplicada.",
            )
          }
        />
      )}
      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditor(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {editor === "moderation"
              ? `Moderação de ${name}`
              : editor === "note"
                ? `Nota sobre ${name}`
                : editor === "alias"
                  ? "Apelido de amigo"
                  : "Apelido no servidor"}
          </DialogTitle>
          <DialogDescription>
            {editor === "nickname"
              ? "Este apelido aparece para os membros do servidor. Deixe vazio para remover."
              : editor === "moderation"
                ? "Gerencie este membro com as suas permissões atuais."
                : "Visível apenas para você, salvo neste dispositivo."}
          </DialogDescription>
          {editor === "moderation" ? (
            <SettingsMembers
              server={server}
              members={[member]}
              currentUserId={user?.id ?? ""}
              canManageRoles={canManageRoles}
              canKick={canKick}
              canBan={canBan}
            />
          ) : (
            <>
              {editor === "note" ? (
                <Textarea
                  aria-label="Nota privada"
                  value={value}
                  maxLength={1000}
                  onChange={(e) => setValue(e.target.value)}
                />
              ) : (
                <Input
                  aria-label="Apelido"
                  value={value}
                  maxLength={32}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    if (editor === "nickname") {
                      if (
                        await run(
                          () => membersService.updateNickname(member.id, value),
                          "Apelido atualizado.",
                        )
                      )
                        setEditor(null);
                    } else {
                      localStorage.setItem(
                        editor === "note" ? noteKey : memberAliasKey(user?.id, member.user_id),
                        value.trim(),
                      );
                      onAliasChange();
                      setEditor(null);
                      toast.success("Salvo.");
                    }
                  } catch {
                    toast.error("Não foi possível salvar.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Salvando…" : "Salvar"}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
