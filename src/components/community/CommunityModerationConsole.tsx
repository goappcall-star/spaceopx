import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { moderationService } from "@/services/community-moderation";
import { moderationError, moderationId } from "@/lib/community-moderation";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import {
  ReportQueueView,
  WarningsView,
  ModerationHistoryView,
  MemberActionForm,
  SecuritySettingsForm,
  ModeratorGrantForm,
  PlatformReviewForm,
  type ModerationPerson,
} from "./ModerationViews";
import type { ModerationCursor, ModerationHistory } from "@/types/community-moderation";
type Tab = "reports" | "warnings" | "history" | "security" | "members" | "mine";
export function CommunityModerationConsole({
  userId,
  serverId,
  people = [],
  roles = [],
}: {
  userId: string;
  serverId?: string;
  people?: ModerationPerson[];
  roles?: ModerationPerson[];
}) {
  const actionAttempt = useRef<{ key: string; id: string } | null>(null);
  function sanction(target: string, action: "warn" | "kick" | "ban", reason: string) {
    const key = JSON.stringify([serverId, target, action, reason]);
    if (actionAttempt.current?.key !== key)
      actionAttempt.current = { key, id: crypto.randomUUID() };
    const id = actionAttempt.current.id;
    return run(async () => {
      await moderationService.act(id, serverId!, target, action, reason);
      actionAttempt.current = null;
    });
  }
  const client = useQueryClient(),
    [tab, setTab] = useState<Tab>("reports"),
    [status, setStatus] = useState("pending"),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState<ModerationCursor>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [directory, setDirectory] = useState(""),
    [directoryInput, setDirectoryInput] = useState("");
  const access = useQuery({
    queryKey: ["moderation-access", userId, serverId ?? "platform"],
    queryFn: () => moderationService.access(serverId),
    enabled: COMMUNITY_V1_ENABLED,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
  const caps = access.isError ? [] : (access.data?.capabilities ?? []),
    platform = !serverId && access.data?.platform === true && !access.isError;
  const tabs: Tab[] = platform
    ? ["reports", "history"]
    : serverId
      ? [
          ...(["reports", "warnings", "history", "security", "members"] as const).filter((t) =>
            caps.includes(t),
          ),
          "mine",
        ]
      : [];
  const current = tabs.includes(tab) ? tab : tabs[0];
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const reports = useQuery({
    queryKey: [
      "moderation-reports",
      userId,
      serverId ?? "platform",
      current,
      status,
      query,
      cursor,
    ],
    queryFn: () => moderationService.reports(serverId, status, query, cursor, current === "mine"),
    enabled: !!current && ["reports", "mine"].includes(current) && access.isSuccess,
    gcTime: 0,
    retry: false,
    refetchInterval: 20000,
  });
  const warnings = useQuery({
    queryKey: ["moderation-warnings", userId, serverId, current, cursor],
    queryFn: () => moderationService.warnings(serverId!, cursor, current === "mine"),
    enabled: !!serverId && ["warnings", "mine"].includes(current ?? "") && access.isSuccess,
    gcTime: 0,
    retry: false,
    refetchInterval: 20000,
  });
  const history = useQuery({
    queryKey: ["moderation-history", userId, serverId ?? "platform", cursor],
    queryFn: () => moderationService.history(serverId, "history", cursor),
    enabled: current === "history" && access.isSuccess,
    gcTime: 0,
    retry: false,
    refetchInterval: 20000,
  });
  const security = useQuery({
    queryKey: ["moderation-security", userId, serverId],
    queryFn: () => moderationService.security(serverId!),
    enabled: current === "security" && !!serverId && caps.includes("security"),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const presentation = useQuery({
    queryKey: ["platform-directory", userId, directory],
    queryFn: () => moderationService.directory(directory),
    enabled: platform && !!directory,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 20000,
  });
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      for (const key of [
        "moderation-access",
        "moderation-reports",
        "moderation-warnings",
        "moderation-history",
        "moderation-security",
        "platform-directory",
        "community-directory",
        "community-directory-featured",
        "community-presentation",
        "members",
        "roles",
        "audit-logs",
        "community-experience",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    } catch (e) {
      setError(moderationError(e));
      void access.refetch();
    } finally {
      setBusy(false);
    }
  }
  function change(t: Tab) {
    setTab(t);
    setCursor(undefined);
    setError(null);
  }
  if (access.isPending)
    return (
      <p role="status" className="p-5">
        Carregando permissões de moderação…
      </p>
    );
  if (access.isError)
    return (
      <section className="space-y-3 p-5">
        <p role="alert">{moderationError(access.error)}</p>
        <Button onClick={() => void access.refetch()}>Tentar novamente</Button>
      </section>
    );
  if (!serverId && !platform)
    return (
      <p role="alert" className="p-5">
        Acesso reservado a uma identidade oficial autorizada no backend.
      </p>
    );
  const activeQuery =
    current === "reports" || current === "mine"
      ? reports
      : current === "warnings"
        ? warnings
        : current === "history"
          ? history
          : current === "security"
            ? security
            : null;
  const page =
    current === "reports" || current === "mine"
      ? reports.data
      : current === "warnings"
        ? warnings.data
        : current === "history"
          ? history.data
          : null;
  return (
    <section className="min-w-0 space-y-5">
      <header>
        <h2 className="text-xl font-bold">
          {platform ? "Central de Segurança da Plataforma" : "Moderação da Comunidade"}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm">
          {platform
            ? "Somente apresentações públicas e denúncias do diretório. Sem acesso geral ao conteúdo privado dos servidores."
            : "Denúncias, advertências e decisões verificadas pelo servidor. Administrador sem delegação não recebe poderes automaticamente."}
        </p>
      </header>
      <nav className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t}
            size="sm"
            variant={current === t ? "default" : "outline"}
            onClick={() => change(t)}
          >
            {
              {
                reports: "Denúncias",
                warnings: "Advertências",
                history: "Histórico",
                security: "Segurança",
                members: "Ações de membros",
                mine: "Minhas denúncias e advertências",
              }[t]
            }
          </Button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="text-destructive rounded-lg border p-3 text-sm">
          {error}
        </p>
      )}
      {(current === "reports" || current === "mine") && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Estado
            <select
              className="bg-surface border-border mt-1 h-10 w-full rounded-lg border px-3"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor(undefined);
              }}
            >
              <option value="pending">Pendentes</option>
              <option value="resolved">Analisadas</option>
              <option value="dismissed">Sem procedência</option>
              <option value="">Todos</option>
            </select>
          </label>
          <label className="text-sm">
            Pesquisar por identificador ou categoria
            <input
              className="bg-surface border-border mt-1 h-10 w-full rounded-lg border px-3"
              maxLength={100}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursor(undefined);
              }}
            />
          </label>
        </div>
      )}
      {activeQuery?.isError ? (
        <div role="alert">
          <p>{moderationError(activeQuery.error)}</p>
          <Button onClick={() => void activeQuery.refetch()}>Atualizar</Button>
        </div>
      ) : activeQuery?.isPending ? (
        <p role="status">Carregando registros…</p>
      ) : (
        <>
          {(current === "reports" || current === "mine") && reports.data && (
            <ReportQueueView
              items={reports.data.items}
              busy={busy || reports.isFetching}
              canReview={current === "reports"}
              onReview={(r, s, reason) =>
                void run(() => moderationService.review(r.id, r.revision, s, reason))
              }
              onDirectory={platform ? setDirectory : undefined}
            />
          )}
          {(current === "warnings" || current === "mine") && warnings.data && !warnings.isError && (
            <WarningsView
              items={warnings.data.items}
              members={people}
              busy={busy || warnings.isFetching}
              canReview={current === "warnings"}
              onRevoke={(w, reason) =>
                void run(() => moderationService.revokeWarning(w.id, w.revision, reason))
              }
            />
          )}
          {current === "mine" && warnings.isError && (
            <p role="alert">{moderationError(warnings.error)}</p>
          )}
          {current === "history" && history.data && (
            <ModerationHistoryView
              items={history.data.items.filter((x): x is ModerationHistory => "entity_id" in x)}
            />
          )}
          {current === "security" && security.data && (
            <>
              <SecuritySettingsForm
                key={security.data.settings.revision}
                initial={security.data.settings}
                busy={busy}
                onSave={(s) => void run(() => moderationService.saveSecurity(serverId!, s))}
              />
              <div className="text-muted-foreground space-y-1 text-xs">
                {security.data.grants.map((g) => (
                  <p key={g.role_id}>
                    {g.name}:{" "}
                    {g.capabilities
                      .map(
                        (c) =>
                          ({
                            reports: "Denúncias",
                            warnings: "Advertências",
                            members: "Membros",
                            security: "Segurança",
                            history: "Histórico",
                          })[c],
                      )
                      .join(", ") || "sem delegação"}
                  </p>
                ))}
              </div>
              {access.data?.owner && (
                <ModeratorGrantForm
                  roles={roles}
                  busy={busy}
                  onGrant={(r, c) => void run(() => moderationService.grant(serverId!, r, c))}
                />
              )}
            </>
          )}
        </>
      )}
      {current === "members" && serverId && (
        <MemberActionForm
          members={people.filter((p) => p.id !== userId)}
          busy={busy}
          canWarn={caps.includes("warnings")}
          canSanction={caps.includes("members")}
          onAction={(t, a, r) => void sanction(t, a, r)}
        />
      )}
      {current === "warnings" && caps.includes("warnings") && serverId && (
        <MemberActionForm
          members={people.filter((p) => p.id !== userId)}
          busy={busy}
          canWarn
          canSanction={false}
          onAction={(t, a, r) => void sanction(t, a, r)}
        />
      )}
      {page && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCursor(undefined);
              void activeQuery?.refetch();
            }}
          >
            Atualizar início
          </Button>
          {page.has_more && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const row = page.items.at(-1);
                if (row) setCursor({ id: row.id, created_at: row.created_at });
              }}
            >
              Próxima página
            </Button>
          )}
        </div>
      )}
      {platform && (
        <section className="space-y-3">
          <label className="block text-sm">
            Identificador da comunidade pública
            <input
              className="bg-surface border-border mt-1 h-10 w-full rounded-lg border px-3"
              maxLength={36}
              value={directoryInput}
              onChange={(e) => setDirectoryInput(e.target.value)}
            />
          </label>
          <Button
            variant="outline"
            onClick={() => {
              try {
                setDirectory(moderationId(directoryInput));
                setError(null);
              } catch {
                setError("Informe um identificador válido de comunidade pública.");
              }
            }}
          >
            Revisar apresentação
          </Button>
          {directory &&
            (presentation.isError ? (
              <p role="alert">{moderationError(presentation.error)}</p>
            ) : presentation.isPending ? (
              <p role="status">Carregando apresentação pública…</p>
            ) : presentation.data ? (
              <PlatformReviewForm
                key={`${directory}:${presentation.data.revision}`}
                data={presentation.data}
                busy={busy || presentation.isFetching}
                onAction={(a, r) =>
                  void run(() =>
                    moderationService.curate(directory, presentation.data!.revision, a, r),
                  )
                }
              />
            ) : (
              <p>Nenhuma apresentação pública disponível.</p>
            ))}
        </section>
      )}
    </section>
  );
}
