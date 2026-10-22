import { CommunityJoinRequestsView } from "./CommunityJoinRequestsView";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { discoveryService } from "@/services/community-discovery";
import { discoveryError } from "@/lib/community-discovery";
import { DiscoverySettingsForm } from "./DiscoverySettingsForm";
export function CommunityDiscoverySettings({
  serverId,
  userId,
  serverName,
}: {
  serverId: string;
  userId: string;
  serverName: string;
}) {
  const client = useQueryClient(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [cursor, setCursor] = useState<{ created_at: string; user_id: string }>();
  const config = useQuery({
    queryKey: ["community-discovery-settings", userId, serverId],
    queryFn: () => discoveryService.settings(serverId),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const requests = useQuery({
    queryKey: ["community-join-requests", userId, serverId, cursor],
    queryFn: () => discoveryService.requests(serverId, cursor),
    retry: false,
    gcTime: 0,
    refetchInterval: 30000,
  });
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await config.refetch();
      await requests.refetch();
      void client.invalidateQueries({ queryKey: ["community-directory"] });
      void client.invalidateQueries({ queryKey: ["community-directory-featured"] });
      void client.invalidateQueries({ queryKey: ["community-presentation"] });
      void client.invalidateQueries({ queryKey: ["members", serverId] });
      void client.invalidateQueries({ queryKey: ["audit-logs", serverId] });
      toast.success("Operação concluída.");
    } catch (e) {
      setError(discoveryError(e));
      void requests.refetch();
    } finally {
      setBusy(false);
    }
  }
  if (config.isPending) return <p role="status">Carregando descoberta…</p>;
  if (config.isError || !config.data)
    return (
      <div role="alert">
        <p>{discoveryError(config.error)}</p>
        <Button onClick={() => void config.refetch()}>Tentar novamente</Button>
      </div>
    );
  return (
    <div className="space-y-6">
      <DiscoverySettingsForm
        key={`${serverId}:${config.data.listing?.revision ?? 0}`}
        data={config.data}
        serverName={serverName}
        busy={busy}
        error={error}
        onSave={(p, r, publish) => void run(() => discoveryService.save(serverId, p, r, publish))}
      />
      <CommunityJoinRequestsView
        items={requests.data?.items ?? []}
        loading={requests.isPending}
        busy={busy || requests.isFetching}
        error={
          requests.isError ? discoveryError(requests.error) : !config.data.is_owner ? error : null
        }
        hasMore={!!requests.data?.has_more}
        onReview={(r, approve) =>
          void run(() => discoveryService.review(serverId, r.user_id, r.revision, approve))
        }
        onFirst={() => {
          setCursor(undefined);
          void requests.refetch();
        }}
        onNext={() => {
          const r = requests.data?.items.at(-1);
          if (r) setCursor({ created_at: r.created_at, user_id: r.user_id });
        }}
      />
    </div>
  );
}
