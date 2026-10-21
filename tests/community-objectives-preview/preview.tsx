import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CommunityObjectivesView,
  AchievementCard,
  MissionDetailsView,
  MissionHistoryView,
} from "@/components/community/CommunityObjectivesView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CommunityMission, CommunityAchievement } from "@/types/community-objectives";
import "../../src/styles.css";
const base: CommunityMission = {
  id: null,
  objective_id: "verified_daily",
  version: 1,
  name: "Participação verificada · diária",
  description:
    "Concluir 3 atividades legítimas comprovadas pelo backend. Verificador ainda não integrado.",
  cadence: "daily",
  target: 3,
  progress: 0,
  period_start: "2026-10-21T00:00:00Z",
  expires_at: "2026-10-22T00:00:00Z",
  completed_at: null,
  status: "unavailable",
  reward_xp: 150,
  awarded_xp: null,
  reward_id: null,
};
const achievements: CommunityAchievement[] = [
  {
    objective_id: "community_foundation",
    version: 1,
    name: "Nossa comunidade",
    description: "Primeira ativação registrada após a Fase 4B. Sem concessão retroativa ou XP.",
    criterion: "first_activation",
    category: "foundation",
    rarity: "common",
    unlocked_at: "2026-10-21T13:00:00Z",
    reward_id: null,
  },
  {
    objective_id: "community_publication",
    version: 1,
    name: "Portas abertas",
    description: "Primeira publicação autorizada pelo proprietário no diretório. Sem XP.",
    criterion: "first_publication",
    category: "foundation",
    rarity: "rare",
    unlocked_at: null,
    reward_id: null,
  },
];
export function Preview() {
  const [mode, setMode] = useState<"safe" | "progress" | "complete">("safe"),
    [panel, setPanel] = useState<"gallery" | "history" | null>(null),
    [selected, setSelected] = useState<CommunityMission | null>(null);
  const daily: CommunityMission =
    mode === "safe"
      ? base
      : mode === "progress"
        ? { ...base, id: "1", status: "in_progress", progress: 2 }
        : {
            ...base,
            id: "1",
            status: "completed",
            progress: 3,
            completed_at: "2026-10-21T16:00:00Z",
            awarded_xp: 50,
          };
  const weekly: CommunityMission = {
    ...base,
    objective_id: "verified_weekly",
    name: "Participação verificada · semanal",
    cadence: "weekly",
    target: 10,
    expires_at: "2026-10-26T00:00:00Z",
    period_start: "2026-10-19T00:00:00Z",
    reward_xp: 500,
    ...(mode === "safe" ? {} : { id: "2", status: "in_progress", progress: 4 }),
  };
  const history: CommunityMission[] = [
    {
      ...base,
      id: "3",
      status: "completed",
      progress: 3,
      completed_at: "2026-10-21T16:00:00Z",
      awarded_xp: 50,
    },
    {
      ...base,
      id: "1",
      status: "expired",
      progress: 1,
      period_start: "2026-10-19T00:00:00Z",
      expires_at: "2026-10-20T00:00:00Z",
    },
  ];
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-background px-5 py-3">
        <span className="text-xs text-primary">
          PRÉVIA LOCAL 4B · DADOS FICTÍCIOS · SEM SUPABASE
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode("safe")}>
            Padrão seguro
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode("progress")}>
            Exemplo em andamento
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode("complete")}>
            Exemplo concluído
          </Button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px]">
        <aside className="hidden w-56 shrink-0 border-r border-border p-6 lg:block">
          <img src="/lobbyx-logo.png" alt="LobbyX" className="mb-5 h-10 w-10" />
          <p className="font-semibold">Órbita</p>
          <p className="mt-2 text-xs text-muted-foreground">Comunidade de demonstração</p>
          <p className="mt-6 rounded-xl bg-primary/10 p-3 text-sm text-primary">Página inicial</p>
          <p className="mt-5 text-xs text-muted-foreground">
            Navegação e hotbar existentes preservadas.
          </p>
        </aside>
        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-8">
          <section className="rounded-2xl border border-primary/20 bg-surface p-6">
            <p className="mb-3 text-xs uppercase tracking-widest text-primary">Comunidade LobbyX</p>
            <h1 className="text-2xl font-bold">Uma história construída em conjunto</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Missões coletivas e marcos permanentes. Ganhos de XP seguem desligados por padrão.
            </p>
          </section>
          <CommunityObjectivesView
            data={{
              server_id: "d4b10000-0000-0000-0000-000000000001",
              missions: [daily, weekly],
              verifier_enabled: mode !== "safe",
              recent_achievements: [achievements[0]!],
            }}
            onDetails={setSelected}
            onGallery={() => setPanel("gallery")}
            onHistory={() => setPanel("history")}
          />
          <p className="text-xs text-muted-foreground">
            Estados em andamento e concluído são demonstrações fictícias. Não comprovam um
            verificador integrado nem sessões WEB/EXE autenticadas.
          </p>
        </main>
      </div>
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
          <p className="text-xs text-primary">DADOS FICTÍCIOS · PRÉVIA LOCAL</p>
          {panel === "gallery" ? (
            <div className="space-y-3">
              {achievements.map((a) => (
                <AchievementCard key={a.objective_id} achievement={a} />
              ))}
            </div>
          ) : (
            <MissionHistoryView missions={history} onDetails={setSelected} />
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
            <DialogTitle>{selected?.name ?? "Detalhes"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-primary">DADOS FICTÍCIOS · PRÉVIA LOCAL</p>
          {selected && <MissionDetailsView mission={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
