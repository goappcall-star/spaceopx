import { useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QuickProfileCard } from "@/components/gamer/QuickProfile";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalCall } from "@/hooks/use-call";
import { useVoice } from "@/hooks/use-voice";
import { blocksService, conversationsService, friendsService } from "@/services/social";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import type { MemberWithProfile } from "@/types";
import { useMyServers, useServerChannels, useServerMembers } from "@/hooks/use-servers";
import { hasPermission } from "@/lib/permissions";
import { memberHasPermission } from "@/services/permissions";
import { requestVoiceMove } from "@/services/voice-moderation";

export function VoiceParticipantActions({
  userId,
  member,
  children,
  onStartDirect,
  onInvite,
  onManageRoles,
}: {
  userId: string;
  member?: MemberWithProfile | undefined;
  children: ReactNode;
  onStartDirect?: ((id: string) => void) | undefined;
  onInvite?: (() => void) | undefined;
  onManageRoles?: (() => void) | undefined;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const self = user?.id === userId;
  const call = useOptionalCall();
  const voice = useVoice();
  const { data: channels = [] } = useServerChannels(member?.server_id ?? null);
  const { data: serverMembers = [] } = useServerMembers(member?.server_id ?? null);
  const { data: servers = [] } = useMyServers();
  const me = serverMembers.find((m) => m.user_id === user?.id);
  const server = servers.find((s) => s.id === member?.server_id);
  const source = Object.entries(voice.participantsByChannel).find(([, participants]) =>
    participants.some((p) => p.user_id === userId && p.voice_session_id),
  );
  const session = source?.[1].find((p) => p.user_id === userId)?.voice_session_id;
  const canMove =
    hasPermission(me, "move_members") || memberHasPermission(me, server?.owner_id, "manage_voice");
  const query = useQueryClient();
  const previousVolume = useRef(100);
  const volume = voice.volumes[userId] ?? 100;
  const videoHidden = voice.hiddenVideos[userId] ?? false;
  const name = member?.nickname ?? member?.profile?.display_name ?? "Usuário";
  const noteKey = `lobbyx:private-note:${user?.id}:${userId}`;

  async function run(action: () => Promise<unknown>, success?: string) {
    try {
      await action();
      await query.invalidateQueries({ queryKey: ["social"] });
      if (success) toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir a ação.");
    }
  }
  function mute(value: boolean) {
    if (value && volume > 0) previousVolume.current = volume;
    voice.setUserVolume(userId, value ? 0 : previousVolume.current);
  }
  function editNote() {
    try {
      setNote(localStorage.getItem(noteKey) ?? "");
      setNoteOpen(true);
    } catch {
      toast.error("Não foi possível abrir sua nota privada.");
    }
  }

  return (
    <>
      <Popover open={profileOpen} onOpenChange={setProfileOpen}>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverAnchor asChild>
            <DropdownMenuTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Ações de ${name}`}
                className="h-full cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onPointerDown={(event) => {
                  if (event.button === 0) event.preventDefault();
                }}
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setMenuOpen(false);
                    setProfileOpen(true);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setProfileOpen(false);
                  setMenuOpen(true);
                }}
              >
                {children}
              </div>
            </DropdownMenuTrigger>
          </PopoverAnchor>
          <DropdownMenuContent side="right" align="start" className="w-60">
            {canMove && source && session && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Mover para</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {channels
                    .filter((c) => c.type === "voice" && c.id !== source[0])
                    .map((c) => (
                      <DropdownMenuItem
                        key={c.id}
                        onSelect={() =>
                          void run(
                            () => requestVoiceMove(userId, source[0], c.id, session),
                            "Solicitação de movimentação enviada.",
                          )
                        }
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                  {channels.filter((c) => c.type === "voice" && c.id !== source[0]).length ===
                    0 && <DropdownMenuLabel>Nenhum outro canal de voz</DropdownMenuLabel>}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem
              onSelect={() =>
                void run(
                  () => navigator.clipboard.writeText(`@${member?.profile?.username ?? name}`),
                  "Menção copiada. Cole no chat.",
                )
              }
            >
              Mencionar
            </DropdownMenuItem>
            {!self && (
              <>
                <DropdownMenuItem
                  disabled={!onStartDirect}
                  onSelect={() =>
                    void run(async () => {
                      const id = await conversationsService.openDirect(userId);
                      onStartDirect?.(id);
                    })
                  }
                >
                  Mensagem
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!call || !member?.profile}
                  onSelect={() =>
                    void run(() =>
                      call!.startCall(
                        {
                          id: userId,
                          display_name: name,
                          username: member?.profile?.username ?? name,
                          avatar_url: member?.profile?.avatar_url ?? null,
                        },
                        false,
                      ),
                    )
                  }
                >
                  Iniciar chamada
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onSelect={editNote}>
              Adicionar nota{" "}
              <span className="ml-auto text-[10px] text-muted-foreground">Só para você</span>
            </DropdownMenuItem>
            {!self && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Volume do usuário · {volume}%</DropdownMenuLabel>
                <div
                  className="px-2 py-3"
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <Slider
                    aria-label={`Volume de ${name}`}
                    value={[volume]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([value]) => voice.setUserVolume(userId, value ?? 100)}
                  />
                </div>
                <DropdownMenuCheckboxItem
                  checked={volume === 0}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={mute}
                >
                  Silenciar
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={videoHidden}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => voice.setVideoHidden(userId, value)}
                >
                  Desativar vídeo
                </DropdownMenuCheckboxItem>
              </>
            )}
            {onInvite && (
              <DropdownMenuItem onSelect={onInvite}>Convidar para o servidor</DropdownMenuItem>
            )}
            {!self && (
              <>
                <DropdownMenuItem
                  onSelect={() =>
                    void run(
                      () => friendsService.sendRequest(userId),
                      "Solicitação de amizade enviada.",
                    )
                  }
                >
                  Adicionar amigo
                </DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={volume === 0 && videoHidden}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => {
                    mute(value);
                    voice.setVideoHidden(userId, value);
                  }}
                >
                  Ignorar nesta chamada
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => void run(() => blocksService.block(userId), "Usuário bloqueado.")}
                >
                  Bloquear
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Cargos</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {member?.roles.length ? (
                  member.roles.map((role) => (
                    <DropdownMenuLabel key={role.id}>
                      <span style={{ color: role.color }}>●</span> {role.name}
                    </DropdownMenuLabel>
                  ))
                ) : (
                  <DropdownMenuLabel>Sem cargos</DropdownMenuLabel>
                )}
                {onManageRoles && (
                  <DropdownMenuItem onSelect={onManageRoles}>
                    Gerenciar cargos do servidor
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              onSelect={() => void run(() => navigator.clipboard.writeText(userId), "ID copiado.")}
            >
              Copiar ID do usuário
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <PopoverContent side="right" align="start" className="glass-panel w-80 overflow-hidden p-0">
          <QuickProfileCard
            userId={userId}
            roles={member?.roles}
            onDone={() => setProfileOpen(false)}
            onStartDirect={onStartDirect}
          />
        </PopoverContent>
      </Popover>
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogTitle>Nota sobre {name}</DialogTitle>
          <DialogDescription>Visível apenas para você, salva neste navegador.</DialogDescription>
          <Textarea
            aria-label="Nota privada"
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button
            onClick={() => {
              try {
                localStorage.setItem(noteKey, note);
                setNoteOpen(false);
                toast.success("Nota salva.");
              } catch {
                toast.error("Não foi possível salvar a nota.");
              }
            }}
          >
            Salvar nota
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
