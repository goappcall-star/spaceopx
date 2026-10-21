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
      <section className="space-y-3">
        <h3 className="font-semibold">Solicitações de entrada</h3>
        <p className="text-muted-foreground text-xs">
          Proprietário e gestores expressamente delegados podem aprovar. A aprovação mantém as
          regras e boas-vindas obrigatórias.
        </p>
        {error && !config.data.is_owner && <p role="alert">{error}</p>}
        {requests.isError ? (
          <p role="alert">{discoveryError(requests.error)}</p>
        ) : requests.isPending ? (
          <p role="status">Carregando solicitações…</p>
        ) : !requests.data.items.length ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma solicitação pendente nesta página.
          </p>
        ) : (
          requests.data.items.map((r) => (
            <div
              className="border-border flex flex-wrap items-center gap-2 rounded-xl border p-3"
              key={r.user_id}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{r.display_name}</span>
              <Button
                size="sm"
                disabled={busy || requests.isFetching}
                onClick={() =>
                  void run(() => discoveryService.review(serverId, r.user_id, r.revision, true))
                }
              >
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || requests.isFetching}
                onClick={() =>
                  void run(() => discoveryService.review(serverId, r.user_id, r.revision, false))
                }
              >
                Rejeitar
              </Button>
            </div>
          ))
        )}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCursor(undefined);
              void requests.refetch();
            }}
          >
            Atualizar início
          </Button>
          {requests.data?.has_more && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const r = requests.data.items.at(-1);
                if (r) setCursor({ created_at: r.created_at, user_id: r.user_id });
              }}
            >
              Próximas solicitações
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
