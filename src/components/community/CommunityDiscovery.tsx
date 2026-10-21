import { useEffect, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { moderationService } from "@/services/community-moderation";
import { CommunityModerationConsole } from "./CommunityModerationConsole";
import { CommunityReportButton } from "./CommunityReportButton";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { discoveryService } from "@/services/community-discovery";
import { discoveryError, emptyDiscoveryFilters } from "@/lib/community-discovery";
import { CommunityDiscoveryView, CommunityPresentationView } from "./CommunityDiscoveryView";
import type { DiscoveryCursor, DiscoveryFilters } from "@/types/community-discovery";
export function CommunityDiscovery({
  userId,
  onEnter,
}: {
  userId: string;
  onEnter: (id: string) => void;
}) {
  const client = useQueryClient(),
    [filters, setFilters] = useState(emptyDiscoveryFilters),
    [debounced, setDebounced] = useState(filters),
    [cursor, setCursor] = useState<DiscoveryCursor>(),
    [selected, setSelected] = useState<string | null>(null),
    [recent, setRecent] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(filters), 400);
    return () => clearTimeout(timer);
  }, [filters]);
  const enabled = COMMUNITY_V1_ENABLED && !!userId;
  const [safety, setSafety] = useState(false);
  const safetyAccess = useQuery({
    queryKey: ["moderation-access", userId, "platform"],
    queryFn: () => moderationService.access(),
    enabled,
    gcTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const page = useQuery({
    queryKey: ["community-directory", userId, debounced, cursor],
    queryFn: () => discoveryService.search(debounced, cursor),
    enabled: enabled && !selected,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 30000,
  });
  const highlighted = useQuery({
    queryKey: ["community-directory-featured", userId],
    queryFn: () => discoveryService.search({ ...emptyDiscoveryFilters, featured: true }),
    enabled: enabled && !selected,
    gcTime: 0,
    retry: false,
    refetchInterval: 60000,
  });
  const detail = useQuery({
    queryKey: ["community-presentation", userId, selected],
    queryFn: () => discoveryService.presentation(selected!),
    enabled: enabled && !!selected,
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 15000,
  });
  const recentQueries = useQueries({
    queries: recent.map((id) => ({
      queryKey: ["community-presentation", userId, id],
      queryFn: () => discoveryService.presentation(id),
      enabled: enabled && !selected,
      gcTime: 0,
      staleTime: 0,
      retry: false,
      refetchInterval: 30000,
    })),
  });
  function change(f: DiscoveryFilters) {
    setCursor(undefined);
    setFilters(f);
  }
  function open(id: string) {
    setSelected(id);
    setActionError(null);
    setRecent((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, 3));
  }
  async function join(withdraw = false) {
    if (!detail.data || busy) return;
    const current = detail.data;
    setBusy(true);
    setActionError(null);
    try {
      const status = await discoveryService.join(current.server_id, current.revision, withdraw);
      await detail.refetch();
      void client.invalidateQueries({ queryKey: ["servers"] });
      if (status === "member") onEnter(current.server_id);
    } catch (e) {
      setActionError(discoveryError(e));
      void detail.refetch();
    } finally {
      setBusy(false);
    }
  }
  if (safety)
    return (
      <section className="flex-1 overflow-y-auto p-5">
        <Button variant="ghost" className="mb-4" onClick={() => setSafety(false)}>
          Voltar para Explorar
        </Button>
        <CommunityModerationConsole key={userId} userId={userId} />
      </section>
    );
  if (selected) {
    if (detail.isError || detail.isPending || !detail.data)
      return (
        <section className="flex-1 space-y-4 p-6">
          <Button variant="outline" onClick={() => setSelected(null)}>
            Voltar para Explorar
          </Button>
          <p role={detail.isError ? "alert" : "status"}>
            {detail.isError
              ? discoveryError(detail.error)
              : detail.isPending
                ? "Carregando apresentação…"
                : "Esta comunidade não está disponível no diretório."}
          </p>
          {detail.isError && (
            <Button onClick={() => void detail.refetch()}>Tentar novamente</Button>
          )}
        </section>
      );
    return (
      <CommunityPresentationView
        reportAction={
          detail.data.can_join ? (
            <CommunityReportButton
              serverId={detail.data.server_id}
              kind="directory"
              targetId={detail.data.server_id}
            />
          ) : undefined
        }
        item={detail.data}
        busy={busy || detail.isFetching}
        error={actionError}
        onBack={() => setSelected(null)}
        onJoin={() => void join()}
        onWithdraw={() => void join(true)}
        onEnter={() => onEnter(detail.data!.server_id)}
      />
    );
  }
  return (
    <>
      {safetyAccess.data?.platform && !safetyAccess.isError && (
        <div className="border-border border-b px-4 py-2">
          <Button variant="outline" size="sm" onClick={() => setSafety(true)}>
            Central de Segurança da Plataforma
          </Button>
        </div>
      )}
      <CommunityDiscoveryView
        filters={filters}
        onFilters={change}
        page={page.data}
        featured={highlighted.isError ? [] : (highlighted.data?.items ?? [])}
        recent={recentQueries.flatMap((q) => (q.isError || !q.data ? [] : [q.data]))}
        loading={page.isFetching || filters !== debounced}
        error={page.isError ? discoveryError(page.error) : null}
        onRetry={() => void page.refetch()}
        onOpen={open}
        onFirst={() => setCursor(undefined)}
        onNext={() => {
          const last = page.data?.items.at(-1);
          if (last?.published_at)
            setCursor({ published_at: last.published_at, server_id: last.server_id });
        }}
      />
    </>
  );
}
