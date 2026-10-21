import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { communityProgressionService } from "@/services/community-progression";
import { CommunityProgressionView, CommunityXpHistoryView } from "./CommunityProgressionView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function CommunityProgression({
  serverId,
  userId,
  canManage,
}: {
  serverId: string;
  userId: string;
  canManage: boolean;
}) {
  const [history, setHistory] = useState(false),
    [before, setBefore] = useState<string | undefined>();
  const summary = useQuery({
    queryKey: ["community-progression", userId, serverId],
    queryFn: () => communityProgressionService.get(serverId),
    enabled: COMMUNITY_V1_ENABLED,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const ledger = useQuery({
    queryKey: ["community-xp-history", userId, serverId, before ?? null],
    queryFn: () => communityProgressionService.history(serverId, before),
    enabled: COMMUNITY_V1_ENABLED && history && canManage,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (summary.isError)
    return (
      <div
        role="status"
        className="rounded-xl border border-border p-4 text-sm text-muted-foreground"
      >
        Evolução indisponível. Confira sua conexão e o acesso à comunidade.{" "}
        <Button variant="ghost" size="sm" onClick={() => void summary.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  if (!summary.data)
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Carregando evolução…
      </p>
    );
  return (
    <>
      <CommunityProgressionView
        data={summary.data}
        onHistory={
          canManage
            ? () => {
                setBefore(undefined);
                setHistory(true);
              }
            : undefined
        }
      />
      <Dialog open={history && canManage} onOpenChange={setHistory}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de XP coletivo</DialogTitle>
          </DialogHeader>
          {ledger.isError ? (
            <p role="alert">Histórico indisponível. Sua permissão pode ter mudado.</p>
          ) : ledger.isPending ? (
            <p role="status">Carregando histórico…</p>
          ) : (
            <CommunityXpHistoryView
              entries={ledger.data ?? []}
              busy={ledger.isFetching}
              canNext={ledger.data?.length === 20}
              onBack={() => setBefore(undefined)}
              onNext={() => setBefore(ledger.data?.at(-1)?.id)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
