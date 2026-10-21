import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCommunityCosmetics } from "@/hooks/use-community-cosmetics";
import { communityEvolutionService } from "@/services/community-evolution";
import { CommunityStatisticsView, CommunityCosmeticsView } from "./CommunityEvolutionViews";
import type { Appearance, CommunityCosmetic } from "@/types/community-evolution";
import { Button } from "@/components/ui/button";
export function CommunityEvolutionPanel({
  serverId,
  userId,
  initial,
}: {
  serverId: string;
  userId: string;
  initial: "statistics" | "cosmetics";
}) {
  const [tab, setTab] = useState(initial),
    [days, setDays] = useState(30),
    [before, setBefore] = useState<string | undefined>(),
    [preview, setPreview] = useState<Appearance | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const cosmetics = useCommunityCosmetics(serverId, userId),
    client = useQueryClient();
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const from = new Date(end.getTime() - days * 86400000).toISOString().slice(0, 10),
    to = end.toISOString().slice(0, 10);
  const stats = useQuery({
    queryKey: ["community-statistics", userId, serverId, from, to, before ?? null],
    queryFn: () => communityEvolutionService.statistics(serverId, from, to, before),
    enabled: tab === "statistics" && cosmetics.data?.can_manage === true && !cosmetics.isError,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  async function equip(item: CommunityCosmetic | null, slot: CommunityCosmetic["slot"]) {
    if (!cosmetics.data || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const next = await communityEvolutionService.equip(
        serverId,
        slot,
        item?.id ?? null,
        cosmetics.data.revision,
      );
      client.setQueryData(["community-cosmetics", userId, serverId], next);
      setPreview(null);
      setMessage("Personalização atualizada.");
    } catch {
      setMessage(
        "Não foi possível aplicar. Sua permissão, desbloqueio ou revisão pode ter mudado.",
      );
      void cosmetics.refetch();
    } finally {
      setBusy(false);
    }
  }
  if (cosmetics.isError)
    return <p role="alert">Não foi possível verificar sua autorização e a personalização.</p>;
  if (!cosmetics.data) return <p role="status">Carregando…</p>;
  if (!cosmetics.data.can_manage)
    return (
      <p role="alert">
        Somente o proprietário ou gestor expressamente autorizado pode acessar esta central.
      </p>
    );
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-2">
        <Button
          variant={tab === "statistics" ? "default" : "outline"}
          onClick={() => setTab("statistics")}
        >
          Estatísticas
        </Button>
        <Button
          variant={tab === "cosmetics" ? "default" : "outline"}
          onClick={() => setTab("cosmetics")}
        >
          Recompensas e personalização
        </Button>
      </nav>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {tab === "statistics" ? (
        stats.isError ? (
          <p role="alert">Estatísticas indisponíveis. Verifique acesso e conexão.</p>
        ) : !stats.data ? (
          <p role="status">Carregando estatísticas…</p>
        ) : (
          <CommunityStatisticsView
            data={stats.data}
            days={days}
            busy={stats.isFetching}
            onPeriod={(n) => {
              setDays(n);
              setBefore(undefined);
            }}
            onNext={() => setBefore(stats.data.history.at(-1)?.id)}
            onFirst={() => setBefore(undefined)}
          />
        )
      ) : (
        <CommunityCosmeticsView
          data={cosmetics.data}
          preview={preview ?? cosmetics.data.equipped}
          onPreview={setPreview}
          onEquip={(i, s) => void equip(i, s)}
          busy={busy}
        />
      )}
    </div>
  );
}
