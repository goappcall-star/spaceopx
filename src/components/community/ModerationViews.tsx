import {
  CommunityHeading,
  CommunitySection,
  CommunityNotice,
  CommunityActions,
  CommunityEmpty,
} from "./CommunityUI";
import { UserRound, ShieldAlert } from "lucide-react";
import { useId, useState } from "react";
import { ShieldCheck, Flag, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  reportCategories,
  moderationCapabilities,
  reportKindLabels,
  moderationActionLabel,
} from "@/lib/community-moderation";
import type {
  CommunityReport,
  CommunityWarning,
  ModerationHistory,
  SecuritySettings,
  ModerationCapability,
  PlatformDirectoryReview,
  ReportCategory,
  ReportKind,
} from "@/types/community-moderation";
const field = "bg-background border-border mt-1 w-full rounded-lg border px-3 py-2 text-sm";
export interface ModerationPerson {
  id: string;
  name: string;
}
export function ReportForm({
  kind,
  targetId,
  busy,
  onSubmit,
}: {
  kind: ReportKind;
  targetId: string;
  busy: boolean;
  onSubmit: (category: ReportCategory, description: string) => void;
}) {
  const [category, setCategory] = useState<ReportCategory>("other"),
    [description, setDescription] = useState("");
  return (
    <form
      className="community-ui space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(category, description);
      }}
    >
      <CommunityHeading
        icon={Flag}
        eyebrow="Cuidado com a comunidade"
        title="Conte o que aconteceu"
        description="Escolha o motivo e acrescente apenas o contexto necessário para uma análise responsável."
      />
      <p className="text-muted-foreground text-sm">
        Envie somente o necessário para análise. A identidade do denunciante não aparece na fila de
        moderação. Denúncias repetidas são agrupadas.
      </p>
      <p className="text-muted-foreground break-all text-xs">
        Referência: {reportKindLabels[kind]} · {targetId}
      </p>
      <label className="block text-sm">
        Categoria
        <select
          className={field}
          value={category}
          onChange={(e) => setCategory(e.target.value as ReportCategory)}
        >
          {reportCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Descrição opcional
        <textarea
          className={field}
          maxLength={2000}
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <p className="text-muted-foreground text-xs">
        Trecho de evidência: até 30 dias. Descrição e vínculo do denunciante: até 90 dias. A análise
        pode precisar de outra pessoa autorizada.
      </p>
      <Button disabled={busy} type="submit">
        <Flag className="h-4 w-4" />
        {busy ? "Enviando…" : "Enviar denúncia"}
      </Button>
    </form>
  );
}
export function ReportQueueView({
  items,
  busy,
  canReview,
  onReview,
  onDirectory,
}: {
  items: CommunityReport[];
  busy: boolean;
  canReview: boolean;
  onReview: (r: CommunityReport, status: "resolved" | "dismissed", reason: string) => void;
  onDirectory?: ((id: string) => void) | undefined;
}) {
  return (
    <div className="community-ui space-y-3">
      {!items.length && (
        <CommunityEmpty
          icon={Flag}
          title="Nenhuma denúncia nesta página"
          description="Novas solicitações de análise aparecerão aqui, de acordo com seu acesso e os filtros escolhidos."
        />
      )}
      {items.map((r) => (
        <ReportCard
          key={`${r.id}:${r.revision}`}
          report={r}
          busy={busy}
          canReview={canReview}
          onReview={onReview}
          onDirectory={onDirectory}
        />
      ))}
    </div>
  );
}
function ReportCard({
  report: r,
  busy,
  canReview,
  onReview,
  onDirectory,
}: {
  report: CommunityReport;
  busy: boolean;
  canReview: boolean;
  onReview: (r: CommunityReport, status: "resolved" | "dismissed", reason: string) => void;
  onDirectory: ((id: string) => void) | undefined;
}) {
  const [reason, setReason] = useState("");
  return (
    <article className="community-ui community-section space-y-4">
      <header className="flex flex-wrap justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {reportCategories.find((c) => c.value === r.category)?.label} · {reportKindLabels[r.kind]}
        </h3>
        <span className="text-primary text-xs">
          {r.status === "pending"
            ? "Pendente"
            : r.status === "resolved"
              ? "Analisada"
              : "Sem procedência"}
        </span>
      </header>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
        <details>
          <summary>Referência da denúncia</summary>
          <p className="break-all">{r.id}</p>
        </details>
      </div>
      {r.description && <p className="text-sm whitespace-pre-wrap break-words">{r.description}</p>}
      <p className="community-eyebrow">Evidência disponível para análise</p>
      <blockquote className="border-l-2 border-primary bg-background rounded-r-lg p-4 text-sm leading-relaxed whitespace-pre-wrap break-words">
        {r.evidence ?? "Evidência indisponível ou com prazo encerrado."}
      </blockquote>
      <p className="text-muted-foreground text-xs">
        A identidade do denunciante não é exibida. Evidência até{" "}
        {new Date(r.evidence_until).toLocaleDateString("pt-BR")}.
      </p>
      {onDirectory && (
        <Button size="sm" variant="outline" onClick={() => onDirectory(r.server_id)}>
          Revisar apresentação pública
        </Button>
      )}
      {r.decisions.map((d, i) => (
        <p key={i} className="text-muted-foreground text-xs">
          {moderationActionLabel(d.action)} · {d.reason ?? "Justificativa com prazo encerrado."} ·
          responsável {d.actor_id?.slice(0, 8) ?? "indisponível"}
        </p>
      ))}
      {canReview && r.status === "pending" && (
        <div className="border-border space-y-2 border-t pt-3">
          <label className="block text-sm">
            Justificativa da decisão
            <input
              className={field}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || reason.trim().length < 3}
              onClick={() => onReview(r, "resolved", reason)}
            >
              Concluir análise
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || reason.trim().length < 3}
              onClick={() => onReview(r, "dismissed", reason)}
            >
              Sem procedência
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
export function MemberActionForm({
  members,
  busy,
  canWarn,
  canSanction,
  onAction,
}: {
  members: ModerationPerson[];
  busy: boolean;
  canWarn: boolean;
  canSanction: boolean;
  onAction: (target: string, action: "warn" | "kick" | "ban", reason: string) => void;
}) {
  const actionGroup = useId();
  const [target, setTarget] = useState(""),
    [action, setAction] = useState<"warn" | "kick" | "ban">(canWarn ? "warn" : "kick"),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false);
  return (
    <form
      className="community-ui space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onAction(target, action, reason);
      }}
    >
      <CommunityHeading
        icon={ShieldAlert}
        eyebrow="Moderação de membros"
        title="Uma decisão clara, com contexto"
        description="Confira a pessoa, escolha a ação e registre um motivo que explique a decisão."
      />
      <div className="community-editor-grid">
        <div className="space-y-4">
          <CommunitySection title="Quem será afetado">
            <label className="block text-sm">
              Membro
              <select
                className={field}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setConfirm(false);
                }}
              >
                <option value="">Escolha um membro</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </CommunitySection>
          <CommunitySection title="Escolha a ação">
            <fieldset disabled={busy} className="space-y-2">
              <legend className="sr-only">Ação</legend>
              {(
                [...(canWarn ? ["warn"] : []), ...(canSanction ? ["kick", "ban"] : [])] as (
                  "warn" | "kick" | "ban"
                )[]
              ).map((a) => (
                <label key={a} className="community-choice cursor-pointer text-sm">
                  <input
                    type="radio"
                    name={actionGroup}
                    checked={action === a}
                    onChange={() => {
                      setAction(a);
                      setConfirm(false);
                    }}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span
                      className={a === "warn" ? "font-semibold" : "font-semibold text-destructive"}
                    >
                      {a === "warn" ? "Advertir" : a === "kick" ? "Expulsar" : "Banir"}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {a === "warn"
                        ? "Registra uma advertência para orientar o membro."
                        : a === "kick"
                          ? "Remove o membro; uma nova entrada ainda depende de convite e verificações."
                          : "Remove o acesso e bloqueia novas entradas enquanto o banimento vigorar."}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </CommunitySection>
          <CommunitySection title="Registre o contexto">
            <label className="block text-sm">
              Motivo obrigatório
              <textarea
                className={field}
                maxLength={1000}
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setConfirm(false);
                }}
                placeholder="Descreva o ocorrido e por que esta ação é necessária."
              />
            </label>
          </CommunitySection>
        </div>
        <aside className="community-editor-preview space-y-3">
          <p className="community-eyebrow">Revise antes de confirmar</p>
          <div className="community-section">
            <UserRound aria-hidden="true" className="mb-3 h-6 w-6 text-primary" />
            <p className="break-words font-semibold">
              {members.find((m) => m.id === target)?.name ?? "Selecione um membro"}
            </p>
            <p
              className={
                "mt-2 text-sm font-semibold " +
                (action === "warn" ? "text-primary" : "text-destructive")
              }
            >
              {action === "warn"
                ? "Advertência"
                : action === "kick"
                  ? "Expulsão do servidor"
                  : "Banimento do servidor"}
            </p>
            <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
              {reason || "O motivo registrado aparecerá aqui."}
            </p>
          </div>
          <CommunityNotice>
            A hierarquia e as permissões são verificadas novamente no servidor. Confira o alvo: esta
            ação altera o histórico ou o acesso do membro.
          </CommunityNotice>
        </aside>
      </div>
      <label className="community-choice text-sm">
        <input
          type="checkbox"
          className="mt-1 accent-primary"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        <span>Conferi o membro, a ação e o motivo.</span>
      </label>
      <CommunityActions>
        <Button
          type="submit"
          variant={action === "warn" ? "default" : "destructive"}
          disabled={busy || !target || reason.trim().length < 3 || !confirm}
        >
          {busy
            ? "Aplicando…"
            : action === "warn"
              ? "Confirmar advertência"
              : action === "kick"
                ? "Confirmar expulsão"
                : "Confirmar banimento"}
        </Button>
      </CommunityActions>
    </form>
  );
}
export function WarningsView({
  items,
  members,
  busy,
  canReview,
  onRevoke,
}: {
  items: CommunityWarning[];
  members: ModerationPerson[];
  busy: boolean;
  canReview: boolean;
  onRevoke: (w: CommunityWarning, reason: string) => void;
}) {
  return (
    <div className="space-y-3">
      {!items.length && (
        <p className="text-muted-foreground text-sm">Nenhuma advertência nesta página.</p>
      )}
      {items.map((w) => (
        <WarningCard
          key={`${w.id}:${w.revision}`}
          warning={w}
          members={members}
          busy={busy}
          canReview={canReview}
          onRevoke={onRevoke}
        />
      ))}
    </div>
  );
}
function WarningCard({
  warning: w,
  members,
  busy,
  canReview,
  onRevoke,
}: {
  warning: CommunityWarning;
  members: ModerationPerson[];
  busy: boolean;
  canReview: boolean;
  onRevoke: (w: CommunityWarning, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <article className="bg-surface border-border space-y-2 rounded-xl border p-4">
      <h3 className="text-sm font-semibold">
        {members.find((m) => m.id === w.target_user_id)?.name ??
          w.target_user_id?.slice(0, 8) ??
          "Membro indisponível"}{" "}
        · {w.status === "active" ? "Advertência ativa" : "Revogada"}
      </h3>
      <p className="text-sm whitespace-pre-wrap break-words">
        {w.reason || "Motivo com prazo encerrado."}
      </p>
      <p className="text-muted-foreground text-xs">
        Responsável:{" "}
        {members.find((m) => m.id === w.actor_id)?.name ??
          w.actor_id?.slice(0, 8) ??
          "indisponível"}{" "}
        · {new Date(w.created_at).toLocaleString("pt-BR")}
      </p>
      {w.decisions.map((d, i) => (
        <p className="text-muted-foreground text-xs" key={i}>
          {moderationActionLabel(d.action)} · {d.reason ?? "Prazo encerrado"} ·{" "}
          {d.actor_id?.slice(0, 8)}
        </p>
      ))}
      {canReview && w.status === "active" && !!w.reason && (
        <div className="space-y-2">
          <label className="block text-sm">
            Motivo da revisão
            <input
              className={field}
              value={reason}
              maxLength={1000}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || reason.trim().length < 3}
            onClick={() => onRevoke(w, reason)}
          >
            Revogar após revisão independente
          </Button>
        </div>
      )}
    </article>
  );
}
export function ModerationHistoryView({ items }: { items: ModerationHistory[] }) {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Decisões desta Central. A auditoria anterior continua disponível com suas permissões atuais.
      </p>
      {!items.length && (
        <p className="text-muted-foreground text-sm">Nenhuma decisão nesta página.</p>
      )}
      {items.map((d) => (
        <article key={d.id} className="border-border space-y-2 rounded-xl border p-3">
          <h3 className="community-choice text-sm">
            <History className="text-primary h-4 w-4" />
            {moderationActionLabel(d.action)}
          </h3>
          <p className="text-sm break-words">{d.reason ?? "Justificativa com prazo encerrado."}</p>
          <p className="text-muted-foreground text-xs">
            {new Date(d.created_at).toLocaleString("pt-BR")} · responsável{" "}
            {d.actor_id?.slice(0, 8) ?? "indisponível"}
          </p>
        </article>
      ))}
    </div>
  );
}
export function SecuritySettingsForm({
  initial,
  busy,
  onSave,
}: {
  initial: SecuritySettings;
  busy: boolean;
  onSave: (s: SecuritySettings) => void;
}) {
  const [value, setValue] = useState(initial),
    [domains, setDomains] = useState(initial.blocked_domains.join("\n"));
  return (
    <form
      className="community-ui community-section space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...value,
          blocked_domains: domains
            .split("\n")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
        });
      }}
    >
      <CommunityHeading
        icon={ShieldCheck}
        eyebrow="Proteção da comunidade"
        title="Filtros contra spam"
        description="Defina limites claros para mensagens, repetições, menções e links. Nenhuma punição é aplicada automaticamente."
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-primary"
          checked={value.enabled}
          onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
        />
        Ativar filtros nesta comunidade
      </label>
      <p className="text-muted-foreground text-xs">
        Desligados por padrão. Bloqueios recusam a mensagem e mantêm o rascunho; não apagam
        mensagens anteriores nem aplicam banimentos automáticos.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            { key: "burst_limit", label: "Mensagens por 10 segundos", min: 3, max: 30 },
            { key: "repeat_limit", label: "Repetições por minuto", min: 2, max: 10 },
            { key: "mentions_limit", label: "Menções por mensagem", min: 1, max: 30 },
          ] as const
        ).map((f) => (
          <label className="community-section text-sm" key={f.key}>
            {f.label}
            <input
              type="number"
              className={field}
              min={f.min}
              max={f.max}
              value={value[f.key]}
              onChange={(e) => setValue({ ...value, [f.key]: Number(e.target.value) })}
            />
          </label>
        ))}
      </div>
      <label className="block text-sm">
        Domínios bloqueados, um por linha
        <textarea
          className={field}
          rows={4}
          maxLength={12700}
          value={domains}
          placeholder="exemplo.test"
          onChange={(e) => setDomains(e.target.value)}
        />
      </label>
      <p className="text-muted-foreground text-xs">
        Correspondência exata e subdomínios de URLs HTTP/HTTPS. Sem IA, consulta externa ou
        reputação automática de links.
      </p>
      <Button disabled={busy} type="submit">
        Salvar segurança
      </Button>
    </form>
  );
}
export function ModeratorGrantForm({
  roles,
  busy,
  onGrant,
}: {
  roles: ModerationPerson[];
  busy: boolean;
  onGrant: (role: string, caps: ModerationCapability[]) => void;
}) {
  const [role, setRole] = useState(""),
    [caps, setCaps] = useState<ModerationCapability[]>([]),
    [confirm, setConfirm] = useState(false);
  return (
    <form
      className="community-ui community-section space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onGrant(role, caps);
      }}
    >
      <CommunityHeading
        icon={ShieldCheck}
        eyebrow="Delegação explícita"
        title="Permissões específicas por cargo"
      />
      <p className="text-muted-foreground text-xs">
        Somente o proprietário delega. A seleção substitui as permissões deste cargo; nenhuma
        marcada revoga a delegação. Cargos com delegação não podem ser escolhidos no onboarding ou
        atribuídos por outros gestores.
      </p>
      <label className="block text-sm">
        Cargo
        <select
          className={field}
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setCaps([]);
            setConfirm(false);
          }}
        >
          <option value="">Escolha um cargo</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {moderationCapabilities.map((c) => (
          <label key={c} className="community-choice text-xs">
            <input
              className="accent-primary"
              type="checkbox"
              checked={caps.includes(c)}
              onChange={(e) => {
                setCaps(e.target.checked ? [...caps, c] : caps.filter((x) => x !== c));
                setConfirm(false);
              }}
            />
            {
              {
                reports: "Denúncias",
                warnings: "Advertências",
                members: "Expulsar/banir",
                security: "Segurança",
                history: "Histórico",
              }[c]
            }
          </label>
        ))}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          className="mt-1 accent-primary"
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        Conferi o cargo e autorizo substituir estas permissões.
      </label>
      <Button type="submit" variant="outline" disabled={busy || !role || !confirm}>
        Aplicar delegação
      </Button>
    </form>
  );
}
export function PlatformReviewForm({
  data,
  busy,
  onAction,
}: {
  data: PlatformDirectoryReview;
  busy: boolean;
  onAction: (action: "suspend" | "restore" | "remove_feature", reason: string) => void;
}) {
  const [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false);
  return (
    <section className="community-ui community-section space-y-4">
      <CommunityNotice>
        Central de Segurança da Plataforma · atuação oficial sobre o diretório público. Gerir uma
        comunidade não concede esta autoridade.
      </CommunityNotice>
      <h3 className="font-semibold">
        Apresentação pública ·{" "}
        {{ listed: "Publicada", unlisted: "Não listada", suspended: "Suspensa" }[data.status]}
      </h3>
      <p className="text-sm font-semibold">
        {data.presentation?.name ?? "Cópia pública com prazo encerrado."}
      </p>
      <p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">
        {data.presentation?.description}
      </p>
      <p className="text-muted-foreground text-xs">
        Esta Central não fornece mensagens, canais ou membros privados. Reverter uma suspensão deixa
        a comunidade não listada; o proprietário precisa publicar novamente.
      </p>
      <label className="block text-sm">
        Justificativa obrigatória
        <textarea
          className={field}
          maxLength={1000}
          rows={3}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setConfirm(false);
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          className="accent-primary"
          type="checkbox"
          checked={confirm}
          onChange={(e) => setConfirm(e.target.checked)}
        />
        Conferi a apresentação e a justificativa.
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          disabled={busy || !confirm || reason.trim().length < 3 || data.status === "suspended"}
          onClick={() => onAction("suspend", reason)}
        >
          Suspender do diretório
        </Button>
        <Button
          variant="outline"
          disabled={busy || !confirm || reason.trim().length < 3 || data.status !== "suspended"}
          onClick={() => onAction("restore", reason)}
        >
          Reverter suspensão
        </Button>
        <Button
          variant="outline"
          disabled={busy || !confirm || reason.trim().length < 3 || !data.featured}
          onClick={() => onAction("remove_feature", reason)}
        >
          Remover destaque
        </Button>
      </div>
    </section>
  );
}
