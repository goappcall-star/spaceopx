import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
const Panel = lazy(() =>
  import("./CommunityEvolutionPanel").then((m) => ({ default: m.CommunityEvolutionPanel })),
);
export function CommunityEvolutionTools({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const [panel, setPanel] = useState<"statistics" | "cosmetics" | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setPanel("statistics")}>
          Estatísticas
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPanel("cosmetics")}>
          Recompensas e personalização
        </Button>
      </div>
      <Dialog
        open={!!panel}
        onOpenChange={(v) => {
          if (!v) setPanel(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Central da Comunidade</DialogTitle>
          </DialogHeader>
          {panel && (
            <Suspense fallback={<p role="status">Carregando central…</p>}>
              <Panel
                key={`${userId}:${serverId}`}
                serverId={serverId}
                userId={userId}
                initial={panel}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
