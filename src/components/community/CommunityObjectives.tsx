import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { communityObjectivesService } from "@/services/community-objectives";
import type { CommunityMission } from "@/types/community-objectives";
import {
  CommunityObjectivesView,
  AchievementCard,
  MissionDetailsView,
  MissionHistoryView,
} from "./CommunityObjectivesView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function CommunityObjectives({ serverId, userId }: { serverId: string; userId: string }) {
  const [panel, setPanel] = useState<"gallery" | "history" | null>(null),
    [selected, setSelected] = useState<CommunityMission | null>(null),
    [after, setAfter] = useState<string | undefined>(),
    [before, setBefore] = useState<string | undefined>();
  const snapshot = useQuery({
    queryKey: ["community-objectives", userId, serverId],
    queryFn: () => communityObjectivesService.get(serverId),
    enabled: COMMUNITY_V1_ENABLED,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const gallery = useQuery({
    queryKey: ["community-achievements", userId, serverId, after ?? null],
    queryFn: () => communityObjectivesService.achievements(serverId, after),
    enabled: COMMUNITY_V1_ENABLED && panel === "gallery",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["community-mission-history", userId, serverId, before ?? null],
    queryFn: () => communityObjectivesService.history(serverId, before),
    enabled: COMMUNITY_V1_ENABLED && panel === "history",
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  if (snapshot.isError)
    return (
      <p
        role="status"
        className="rounded-xl border border-border p-4 text-sm text-muted-foreground"
      >
        Missões e conquistas indisponíveis. Verifique a conexão e seu acesso.{" "}
        <Button variant="ghost" size="sm" onClick={() => void snapshot.refetch()}>
          Tentar novamente
        </Button>
      </p>
    );
  if (!snapshot.data)
    return (
      <p role="status" className="p-4 text-sm text-muted-foreground">
        Carregando missões e conquistas…
      </p>
    );
  return (
    <>
      <CommunityObjectivesView
        data={snapshot.data}
        onDetails={setSelected}
        onGallery={() => {
          setAfter(undefined);
          setPanel("gallery");
        }}
        onHistory={() => {
          setBefore(undefined);
          setPanel("history");
        }}
      />
      <Dialog
        open={!!panel}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {panel === "gallery" ? "Galeria de conquistas" : "Histórico de missões"}
            </DialogTitle>
          </DialogHeader>
          {(panel === "gallery" ? gallery.isError : history.isError) ? (
            <p role="alert">Não foi possível carregar. Sua conexão ou permissão pode ter mudado.</p>
          ) : (panel === "gallery" ? gallery.isPending : history.isPending) ? (
            <p role="status">Carregando…</p>
          ) : (
            <>
              {panel === "gallery" ? (
                <div className="space-y-3">
                  {(gallery.data ?? []).map((a) => (
                    <AchievementCard key={a.objective_id} achievement={a} />
                  ))}
                </div>
              ) : (
                <MissionHistoryView missions={history.data ?? []} onDetails={setSelected} />
              )}
              <div className="flex justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAfter(undefined);
                    setBefore(undefined);
                  }}
                >
                  Voltar ao início
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    panel === "gallery"
                      ? gallery.isFetching || gallery.data?.length !== 20
                      : history.isFetching || history.data?.length !== 20
                  }
                  onClick={() => {
                    if (panel === "gallery") setAfter(gallery.data?.at(-1)?.objective_id);
                    else setBefore(history.data?.at(-1)?.id ?? undefined);
                  }}
                >
                  Próxima página
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Detalhes da missão"}</DialogTitle>
          </DialogHeader>
          {selected && <MissionDetailsView mission={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
