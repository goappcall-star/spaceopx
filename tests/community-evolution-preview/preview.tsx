import { useState, type ComponentProps } from "react";
import {
  CommunityObjectivesView,
  MissionDetailsView,
  AchievementCard,
  MissionHistoryView,
} from "@/components/community/CommunityObjectivesView";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CommunityObjectives, CommunityMission } from "@/types/community-objectives";
import {
  CommunityStatisticsView,
  CommunityCosmeticsView,
} from "@/components/community/CommunityEvolutionViews";
import { CommunityHome } from "@/components/community/CommunityHome";
import { CommunityProgressionView } from "@/components/community/CommunityProgressionView";
import { Button } from "@/components/ui/button";
import type {
  CommunityCosmetics,
  CommunityStatistics,
  Appearance,
} from "@/types/community-evolution";
import type { CommunityExperience } from "@/types/community-experience";
import type { Server } from "@/types";
import "../../src/styles.css";
const sid = "d4c00000-0000-0000-0000-000000000001";
const base: CommunityCosmetics = {
  server_id: sid,
  revision: 0,
  can_manage: true,
  selection: {},
  equipped: {},
  items: [
    {
      id: "lx_foundation_seal",
      name: "Selo de fundação",
      description: "Selo vetorial original, estático e leve.",
      slot: "seal",
      render_key: "foundation_seal",
      owned: true,
      available: true,
      requires_mission: false,
    },
    {
      id: "lx_lime_highlight",
      name: "Destaque limão",
      description: "Detalhe visual da comunidade.",
      slot: "highlight",
      render_key: "lime_highlight",
      owned: true,
      available: true,
      requires_mission: false,
    },
    {
      id: "lx_orbit_theme",
      name: "Órbita violeta",
      description: "Paleta roxa e verde-limão limitada à comunidade.",
      slot: "theme",
      render_key: "orbit_theme",
      owned: true,
      available: true,
      requires_mission: false,
    },
    {
      id: "lx_grid_banner",
      name: "Horizonte orbital",
      description: "Banner geométrico original, sem animação.",
      slot: "banner",
      render_key: "grid_banner",
      owned: true,
      available: true,
      requires_mission: false,
    },
    {
      id: "lx_orbit_frame",
      name: "Moldura orbital",
      description: "Exige missão semanal verificada; fonte ainda desligada.",
      slot: "frame",
      render_key: "orbit_frame",
      owned: false,
      available: false,
      requires_mission: true,
    },
  ],
};
const progression = {
  server_id: sid,
  xp: 1250,
  level: 2,
  level_floor: 1000,
  next_level_xp: 2500,
  curve_version: 1,
  earning_enabled: false,
  daily_cap: 500,
  weekly_cap: 2000,
};
const server = {
  id: sid,
  name: "Órbita · comunidade de demonstração",
  description: "Um lugar para conversar e reunir seu squad.",
  icon_url: "/lobbyx-logo.png",
  banner_url: "/auth/lobbyx-city-v1.webp",
  visibility: "private",
} as Server;
const experience: CommunityExperience = {
  server_id: sid,
  revision: 1,
  rules_revision: 1,
  can_manage: true,
  screened: false,
  rules: [],
  interests: [],
  progress: {
    accepted_revision: 1,
    interests: [],
    selected_roles: [],
    completed_revision: 1,
    updated_at: new Date().toISOString(),
  },
  experience: {
    home_enabled: true,
    intro: server.description ?? "",
    banner_url: null,
    notices: [],
    featured_channels: [],
    modules: [],
    welcome_enabled: false,
    welcome_text: "",
    rules_enabled: false,
    rules_required: false,
    interests_enabled: false,
    channels_enabled: false,
    roles_enabled: false,
    role_ids: [],
  },
};
export function Preview({
  view,
  embedded = false,
  home,
}: {
  view?: "home" | "statistics" | "cosmetics" | "evolution";
  embedded?: boolean;
  home?: Partial<ComponentProps<typeof CommunityHome>>;
} = {}) {
  const [localTab, setTab] = useState<"home" | "statistics" | "cosmetics">("home"),
    [data, setData] = useState(base),
    [preview, setPreview] = useState<Appearance | null>(null),
    [days, setDays] = useState(30),
    [empty, setEmpty] = useState(false),
    [mission, setMission] = useState<CommunityMission | null>(null),
    [objectivePanel, setObjectivePanel] = useState<"gallery" | "history" | null>(null);
  const tab = view ?? localTab;
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const to = end.toISOString().slice(0, 10),
    from = new Date(end.getTime() - days * 86400000).toISOString().slice(0, 10);
  const points = [300, 450, 500];
  let balance = 0;
  const daily = points.map((xp, n) => {
    balance += xp;
    return {
      day: new Date(end.getTime() - (3 - n) * 86400000).toISOString().slice(0, 10),
      xp,
      balance,
    };
  });
  const stats: CommunityStatistics = {
    server_id: sid,
    from,
    to,
    progression,
    xp_received: empty ? 0 : 1250,
    missions_completed: empty ? 0 : 2,
    achievements_unlocked: empty ? 0 : 2,
    members_current: 12,
    member_growth: null,
    events_realized: null,
    attendance_verified: null,
    events_created: empty ? 0 : 3,
    events_scheduled: empty ? 0 : 2,
    events_cancelled: empty ? 0 : 1,
    rsvp_going: empty ? 0 : 4,
    daily: empty ? [] : daily,
    history: empty
      ? []
      : [...daily].reverse().map((d, n) => ({
          id: String(3 - n),
          awarded_xp: d.xp,
          requested_xp: d.xp,
          total_after: d.balance,
          created_at: d.day + "T12:00:00Z",
        })),
  };
  const objectives: CommunityObjectives = {
    server_id: sid,
    verifier_enabled: false,
    missions: [
      {
        id: null,
        objective_id: "verified_daily",
        version: 1,
        name: "Participação verificada · diária",
        description: "Exige verificador confiável ainda não integrado.",
        cadence: "daily",
        target: 3,
        progress: 0,
        period_start: daily.at(-1)!.day + "T00:00:00Z",
        expires_at: to + "T00:00:00Z",
        completed_at: null,
        status: "unavailable",
        reward_xp: 150,
        awarded_xp: null,
        reward_id: null,
      },
    ],
    recent_achievements: [
      {
        objective_id: "community_foundation",
        version: 1,
        name: "Nossa comunidade",
        description: "Primeira ativação autorizada, sem XP.",
        criterion: "first_activation",
        category: "foundation",
        rarity: "common",
        unlocked_at: daily[0]!.day + "T12:00:00Z",
        reward_id: null,
      },
      {
        objective_id: "community_publication",
        version: 1,
        name: "Portas abertas",
        description: "Primeira publicação autorizada, sem XP.",
        criterion: "first_publication",
        category: "foundation",
        rarity: "rare",
        unlocked_at: daily[1]!.day + "T12:00:00Z",
        reward_id: null,
      },
    ],
  };
  return (
    <div className="min-h-screen bg-background text-foreground">
      {!embedded && (
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-background p-3">
          <p className="text-xs text-primary">
            PRÉVIA LOCAL 4C · DADOS FICTÍCIOS · SEM SUPABASE · APLICAÇÃO SÓ NA MEMÓRIA
          </p>
          <nav className="flex flex-wrap gap-2">
            {(["home", "statistics", "cosmetics"] as const).map((t) => (
              <Button
                key={t}
                size="sm"
                variant={tab === t ? "default" : "outline"}
                onClick={() => setTab(t)}
              >
                {t === "home" ? "Home" : t === "statistics" ? "Estatísticas" : "Personalização"}
              </Button>
            ))}
          </nav>
        </header>
      )}
      <div className="mx-auto flex max-w-[1550px]">
        {!embedded && (
          <aside className="hidden w-56 shrink-0 border-r border-border p-6 lg:block">
            <img src="/lobbyx-logo.png" alt="LobbyX" className="h-10 w-10" />
            <p className="mt-5 font-semibold">Órbita</p>
            <p className="mt-2 text-xs text-muted-foreground">Comunidade de demonstração</p>
            <p className="mt-6 text-sm text-primary">Página inicial</p>
            <p className="mt-5 text-xs text-muted-foreground">
              Navegação e hotbar existentes preservadas.
            </p>
          </aside>
        )}
        <main className="min-w-0 flex-1">
          {tab === "home" ? (
            <CommunityHome
              server={server}
              data={experience}
              channels={[]}
              participants={{}}
              onChannel={() => {}}
              onOnboarding={() => {}}
              onSettings={() => setTab("cosmetics")}
              appearance={data.equipped}
              evolutionTools={
                <Button size="sm" variant="outline" onClick={() => setTab("statistics")}>
                  Estatísticas
                </Button>
              }
              {...home}
              progression={
                <>
                  <CommunityProgressionView data={progression} />
                  <CommunityObjectivesView
                    data={objectives}
                    onDetails={setMission}
                    onGallery={() => setObjectivePanel("gallery")}
                    onHistory={() => setObjectivePanel("history")}
                  />
                </>
              }
            />
          ) : (
            <div className="space-y-5 p-4 md:p-8">
              {tab === "evolution" ? (
                <>
                  <CommunityProgressionView data={progression} />
                  <CommunityObjectivesView
                    data={objectives}
                    onDetails={setMission}
                    onGallery={() => setObjectivePanel("gallery")}
                    onHistory={() => setObjectivePanel("history")}
                  />
                </>
              ) : tab === "statistics" ? (
                <>
                  <Button variant="outline" onClick={() => setEmpty(!empty)}>
                    {empty ? "Exemplo com registros" : "Período sem registros"}
                  </Button>
                  <CommunityStatisticsView
                    data={stats}
                    days={days}
                    busy={false}
                    onPeriod={setDays}
                    onNext={() => {}}
                    onFirst={() => {}}
                  />
                </>
              ) : (
                <CommunityCosmeticsView
                  data={data}
                  preview={preview ?? data.equipped}
                  onPreview={setPreview}
                  busy={false}
                  onEquip={(item, slot) => {
                    if (item && !item.available) return;
                    const selection = { ...data.selection },
                      equipped = { ...data.equipped };
                    if (item) {
                      selection[slot] = item.id;
                      equipped[slot] = item.render_key;
                    } else {
                      delete selection[slot];
                      delete equipped[slot];
                    }
                    setData({ ...data, revision: data.revision + 1, selection, equipped });
                    setPreview(null);
                  }}
                />
              )}
            </div>
          )}
        </main>
      </div>
      <Dialog
        open={!!mission}
        onOpenChange={(v) => {
          if (!v) setMission(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mission?.name ?? "Detalhes"}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-primary">DADOS FICTÍCIOS · PRÉVIA</p>
          {mission && <MissionDetailsView mission={mission} />}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!objectivePanel}
        onOpenChange={(v) => {
          if (!v) setObjectivePanel(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {objectivePanel === "gallery" ? "Galeria de conquistas" : "Histórico de missões"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-primary">DADOS FICTÍCIOS · PRÉVIA</p>
          {objectivePanel === "gallery" ? (
            objectives.recent_achievements.map((a) => (
              <AchievementCard key={a.objective_id} achievement={a} />
            ))
          ) : (
            <MissionHistoryView missions={[]} onDetails={setMission} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
