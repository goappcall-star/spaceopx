import { CommunityCustomization } from "@/components/community/CommunityCustomization";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LockKeyhole, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { CommunityActivationWizard } from "@/components/community/CommunityActivationWizard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useCommunity } from "@/hooks/use-community";
import { useServerChannels } from "@/hooks/use-servers";
import { useServerRoles } from "@/hooks/use-server-admin";
import { communitiesService, communityErrorMessage } from "@/services/communities";
import { COMMUNITY_CATEGORIES } from "@/lib/community-validation";
import type { MemberWithProfile, Server } from "@/types";
import type { CommunityPayload, CommunitySettings } from "@/types/community";

export function SettingsCommunity({
  server,
  members,
  currentUserId,
  canEditProfile,
  onEditProfile,
}: {
  server: Server;
  members: MemberWithProfile[];
  currentUserId: string;
  canEditProfile: boolean;
  onEditProfile: () => void;
}) {
  const client = useQueryClient();
  const query = useCommunity(server.id, currentUserId);
  const { data: channels = [], isFetching: loadingChannels } = useServerChannels(server.id);
  const { data: roles = [], isFetching: loadingRoles } = useServerRoles(server.id);
  const [wizard, setWizard] = useState<{ initial: CommunitySettings | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [disableRevision, setDisableRevision] = useState<number | null>(null);
  const [roleId, setRoleId] = useState("");
  const [grantConfirmation, setGrantConfirmation] = useState<{
    roleId: string;
    enabled: boolean;
  } | null>(null);
  const state = query.data,
    settings = state?.settings ?? null;
  const authorized = state?.can_manage === true && !query.isError && !query.isPaused;
  const canManage = authorized && !query.isFetching;
  const selectedRole = roles.find(
    (r) => r.id === roleId && r.server_id === server.id && !r.is_owner && r.name !== "MEMBER",
  );
  const delegated = selectedRole?.permissions["manage_community"] === true;
  const grantConfirmed =
    grantConfirmation?.roleId === selectedRole?.id && grantConfirmation?.enabled === !delegated;
  const affected = selectedRole
    ? members.filter((m) => m.roles.some((r) => r.id === selectedRole.id)).length
    : 0;

  async function run(action: () => Promise<unknown>, success: string, after?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      after?.();
      toast.success(success);
      for (const key of [
        ["community", currentUserId, server.id],
        ["roles", server.id],
        ["members", server.id],
        ["audit-logs", server.id],
      ]) {
        void client.invalidateQueries({ queryKey: key });
      }
    } catch (error) {
      toast.error(communityErrorMessage(error));
      void query.refetch();
    } finally {
      setBusy(false);
    }
  }
  if (query.isPending && !wizard)
    return (
      <p role="status" className="text-muted-foreground text-sm">
        Carregando configuração da comunidade…
      </p>
    );
  if ((query.isError || !state) && !wizard)
    return (
      <div className="space-y-3">
        <p role="alert" className="text-destructive text-sm">
          {communityErrorMessage(query.error)}
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  if (wizard)
    return (
      <>
        {query.isError && (
          <div role="alert" className="text-destructive mb-3 text-sm">
            {communityErrorMessage(query.error)}{" "}
            <Button variant="link" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        <CommunityActivationWizard
          server={server}
          channels={channels}
          initial={wizard.initial}
          busy={busy}
          canSubmit={canManage && !loadingChannels}
          conflict={(wizard.initial?.revision ?? 0) !== (settings?.revision ?? 0)}
          onSubmit={(payload: CommunityPayload, revision) =>
            void run(
              () => communitiesService.save(server.id, payload, revision),
              settings?.enabled
                ? "Configuração da comunidade salva."
                : "Comunidade ativada. Seus dados foram preservados.",
              () => setWizard(null),
            )
          }
          onCancel={() => setWizard(null)}
          onEditProfile={onEditProfile}
          canEditProfile={canEditProfile}
        />
      </>
    );

  return (
    <div className="space-y-7">
      <section className="border-primary/25 bg-primary/5 rounded-2xl border p-5">
        <div className="flex items-center gap-3">
          <Users className="text-primary h-6 w-6" />
          <div>
            <h3 className="font-semibold">
              {settings?.enabled ? "Sua Comunidade LobbyX" : "Ative sua Comunidade LobbyX"}
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              {settings?.enabled
                ? "Ativa neste servidor · Fase 1"
                : settings
                  ? "Configuração preservada · comunidade desativada"
                  : "Organização, regras e identidade para o mesmo servidor"}
            </p>
          </div>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          Canais, mensagens, membros, cargos, convites e XP permanecem no lugar. Ativar não inclui o
          servidor na descoberta pública nem altera suas permissões.
        </p>
        {authorized ? (
          <Button
            className="mt-4"
            onClick={() => setWizard({ initial: settings })}
            disabled={busy || !canManage || loadingChannels}
          >
            <ShieldCheck className="h-4 w-4" />
            {settings?.enabled
              ? "Editar configuração"
              : settings
                ? "Reativar comunidade"
                : "Ativar Comunidade"}
          </Button>
        ) : (
          <p className="text-muted-foreground mt-4 text-xs">
            Somente o proprietário ou cargos expressamente autorizados podem gerenciar a comunidade.
          </p>
        )}
      </section>
      {settings && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Configuração preservada</h3>
          <dl className="border-border bg-surface grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Regras</dt>
              <dd className="mt-1">
                {settings.rules.length} {settings.rules.length === 1 ? "regra" : "regras"} · versão{" "}
                {settings.rules_revision}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Boas-vindas</dt>
              <dd className="mt-1">
                {channels.find(
                  (c) =>
                    c.id === settings.welcome_channel_id &&
                    ["text", "announcement"].includes(c.type),
                )?.name ?? "Canal indisponível — ajuste a configuração"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Categoria</dt>
              <dd className="mt-1">
                {COMMUNITY_CATEGORIES.find((c) => c.value === settings.category_slug)?.label}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Interesses</dt>
              <dd className="mt-1 break-words">
                {settings.interests.join(", ") || "Nenhum selecionado"}
              </dd>
            </div>
          </dl>
          <ol className="space-y-2">
            {settings.rules.map((r, i) => (
              <li
                key={r.id}
                className="border-border rounded-lg border p-3 text-sm whitespace-pre-wrap break-words"
              >
                <span className="text-primary mr-2">{i + 1}.</span>
                {r.text}
              </li>
            ))}
          </ol>
        </section>
      )}
      {authorized && settings?.enabled && (
        <CommunityCustomization
          serverId={server.id}
          userId={currentUserId}
          channels={channels}
          roles={roles}
          canUpload={canEditProfile}
        />
      )}
      {state?.is_owner && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Quem pode gerenciar a comunidade</h3>
          <p className="text-muted-foreground text-xs">
            A ativação não autoriza nenhum cargo automaticamente. Escolha um cargo específico e
            confirme o alcance. OWNER é autorizado pela propriedade; MEMBER não é elegível porque é
            atribuído automaticamente por convite.
          </p>
          <Label htmlFor="community-manager-role">Cargo autorizado</Label>
          <select
            id="community-manager-role"
            className="border-border bg-surface h-11 w-full rounded-lg border px-3 text-sm"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              setGrantConfirmation(null);
            }}
            disabled={busy || loadingRoles}
          >
            <option value="">Selecione um cargo</option>
            {roles
              .filter((r) => r.server_id === server.id && !r.is_owner && r.name !== "MEMBER")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.permissions["manage_community"] === true ? " · autorizado" : ""}
                </option>
              ))}
          </select>
          {selectedRole && (
            <div className="border-border bg-surface space-y-3 rounded-xl border p-4">
              <p className="text-sm">
                <strong>{selectedRole.name}</strong> · {affected}{" "}
                {affected === 1 ? "membro carregado usa" : "membros carregados usam"} este cargo.
              </p>
              <p className="text-muted-foreground text-xs">
                {delegated
                  ? "Revogar impede novas operações de gestão por este cargo. Os dados da comunidade permanecem preservados."
                  : "Todos os membros que já possuem este cargo poderão gerenciar a comunidade. Somente o proprietário poderá conceder novas associações a ele enquanto esta autorização estiver ativa."}
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={grantConfirmed}
                  onChange={(e) =>
                    setGrantConfirmation(
                      e.target.checked && selectedRole
                        ? { roleId: selectedRole.id, enabled: !delegated }
                        : null,
                    )
                  }
                  disabled={busy}
                  className="mt-1 accent-primary"
                />
                <span>
                  Confirmo {delegated ? "revogar" : "conceder"} a gestão da comunidade para este
                  cargo.
                </span>
              </label>
              <Button
                variant="outline"
                disabled={busy || !grantConfirmed || !canManage || loadingRoles}
                onClick={() =>
                  void run(
                    () => communitiesService.delegate(server.id, selectedRole.id, !delegated),
                    delegated ? "Delegação revogada." : "Cargo autorizado pelo proprietário.",
                    () => setGrantConfirmation(null),
                  )
                }
              >
                <ShieldCheck className="h-4 w-4" />
                {delegated ? "Revogar autorização" : "Autorizar cargo"}
              </Button>
            </div>
          )}
        </section>
      )}
      <div className="border-border bg-surface flex gap-3 rounded-xl border p-4">
        <LockKeyhole className="text-primary h-5 w-5 shrink-0" />
        <p className="text-muted-foreground text-xs">
          Descoberta pública, onboarding obrigatório, eventos e evolução coletiva pertencem às fases
          seguintes. Nenhum desses recursos é habilitado por esta ativação.
        </p>
      </div>
      {authorized && settings?.enabled && (
        <section className="border-border space-y-3 border-t pt-5">
          <h3 className="text-sm font-semibold">Voltar a servidor comum</h3>
          <p className="text-muted-foreground text-xs">
            Desativa o modo comunidade e mantém esta configuração, todos os dados e os convites para
            uma futura reativação.
          </p>
          <Button
            variant="outline"
            onClick={() => setDisableRevision(settings.revision)}
            disabled={busy || !canManage}
          >
            Desativar comunidade
          </Button>
        </section>
      )}
      <AlertDialog
        open={disableRevision !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDisableRevision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Voltar a servidor comum?</AlertDialogTitle>
            <AlertDialogDescription>
              Mensagens, canais, membros, cargos, convites e a configuração da comunidade serão
              preservados. Você poderá reativá-la depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              disabled={busy || !canManage}
              onClick={() => {
                if (disableRevision !== null)
                  void run(
                    () => communitiesService.disable(server.id, disableRevision),
                    "Comunidade desativada. Dados e configuração preservados.",
                    () => setDisableRevision(null),
                  );
              }}
            >
              <Check className="h-4 w-4" />
              {busy ? "Desativando…" : "Confirmar desativação"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
