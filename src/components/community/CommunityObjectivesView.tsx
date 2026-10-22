import "./community-ui.css";
import { Flag, LockKeyhole, Trophy, Check, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  CommunityObjectives,
  CommunityMission,
  CommunityAchievement,
  MissionStatus,
} from "@/types/community-objectives";
const status: Record<MissionStatus, string> = {
  unavailable: "Futura · indisponível",
  available: "Disponível",
  in_progress: "Em andamento",
  completed: "Concluída",
  expired: "Expirada",
};
const rarity: Record<CommunityAchievement["rarity"], string> = {
  common: "Comum",
  rare: "Rara",
  epic: "Épica",
  legendary: "Lendária",
};
function MissionCard({
  mission: m,
  onDetails,
}: {
  mission: CommunityMission;
  onDetails: (m: CommunityMission) => void;
}) {
  return (
    <article
      data-state={m.status}
      className="community-ui community-mission rounded-xl border border-border bg-background p-4"
    >
      <div className="flex flex-wrap justify-between gap-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {m.cadence === "daily" ? "Diária" : "Semanal"}
        </span>
        <span
          className={
            "text-xs " + (m.status === "completed" ? "text-lime-400" : "text-muted-foreground")
          }
        >
          {status[m.status]}
        </span>
      </div>
      <h3 className="mt-3 font-semibold">{m.name}</h3>
      <p className="mt-2 text-xs text-muted-foreground">
        {m.progress} / {m.target} atividades verificadas
      </p>
      <div
        className="my-3 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={m.name}
        aria-valuemin={0}
        aria-valuemax={m.target}
        aria-valuenow={m.progress}
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(100 * m.progress) / m.target}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {m.reward_xp > 0 ? `Até ${m.reward_xp} XP · sujeito aos tetos` : "Sem recompensa de XP"}
        </p>
        <Button size="sm" variant="ghost" onClick={() => onDetails(m)}>
          Detalhes
        </Button>
      </div>
    </article>
  );
}
export function AchievementCard({ achievement: a }: { achievement: CommunityAchievement }) {
  return (
    <article className="rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2">
        {a.unlocked_at ? (
          <Trophy className="h-9 w-9 shrink-0 rounded-lg border border-border p-2 text-lime-400" />
        ) : (
          <LockKeyhole className="h-9 w-9 shrink-0 rounded-lg border border-border p-2 text-muted-foreground" />
        )}
        <h3 className="font-semibold">{a.name}</h3>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
      <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {rarity[a.rarity]} · {a.category === "foundation" ? "Fundação" : "Participação"}
        </span>
        <span>
          {a.unlocked_at
            ? `Desbloqueada em ${new Date(a.unlocked_at).toLocaleDateString("pt-BR")}`
            : "Bloqueada"}
        </span>
      </div>
      {a.reward_id && (
        <p className="mt-3 text-xs text-muted-foreground">
          Desbloqueio cosmético registrado. A disponibilidade pode ser consultada em Recompensas e
          personalização.
        </p>
      )}
    </article>
  );
}
export function CommunityObjectivesView({
  data,
  onDetails,
  onGallery,
  onHistory,
}: {
  data: CommunityObjectives;
  onDetails: (m: CommunityMission) => void;
  onGallery: () => void;
  onHistory: () => void;
}) {
  return (
    <section className="space-y-6" aria-label="Missões e conquistas coletivas">
      <div className="rounded-2xl border border-primary/20 bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Flag className="h-5 w-5 text-primary" />
            Missões da comunidade
          </h2>
          <Button variant="outline" size="sm" onClick={onHistory}>
            Histórico de missões
          </Button>
        </div>
        {!data.verifier_enabled && (
          <p className="my-4 rounded-xl border border-border p-3 text-xs leading-relaxed text-muted-foreground">
            O verificador de participação ainda não está integrado. As missões estão preparadas para
            o futuro e não progridem com mensagens, RSVP ou tempo em chamadas.
          </p>
        )}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {data.missions.length ? (
            data.missions.map((m) => (
              <MissionCard key={m.objective_id} mission={m} onDetails={onDetails} />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma missão configurada.</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <Trophy className="h-5 w-5 text-lime-400" />
            Conquistas recentes
          </h2>
          <Button variant="outline" size="sm" onClick={onGallery}>
            Galeria de conquistas
          </Button>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {data.recent_achievements.length ? (
            data.recent_achievements.map((a) => (
              <AchievementCard key={a.objective_id} achievement={a} />
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhuma conquista registrada. Marcos anteriores não foram concedidos retroativamente.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
export function MissionDetailsView({ mission: m }: { mission: CommunityMission }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="leading-relaxed text-muted-foreground">{m.description}</p>
      <p className="flex items-center gap-2">
        <Check className="h-4 w-4 text-primary" />
        {status[m.status]} · {m.progress}/{m.target}
      </p>
      <p className="text-muted-foreground">
        Período: {new Date(m.period_start).toLocaleString("pt-BR")} até{" "}
        {new Date(m.expires_at).toLocaleString("pt-BR")}.
      </p>
      <p>
        {m.reward_xp > 0
          ? `Recompensa configurada: até ${m.reward_xp} XP, sujeita aos mesmos limites diários e semanais da comunidade.`
          : "Esta missão não concede XP."}
      </p>
      {m.awarded_xp !== null && (
        <p className="text-lime-400">
          XP efetivamente concedido: {m.awarded_xp}. A conclusão não garante o valor integral se o
          teto tiver sido atingido.
        </p>
      )}
      {m.reward_id && (
        <p className="text-muted-foreground">
          Recompensa cosmética registrada. Consulte Recompensas e personalização para verificar a
          disponibilidade.
        </p>
      )}
      {m.status === "unavailable" && (
        <p className="rounded-xl border border-border p-3 text-muted-foreground">
          Indisponível até haver verificação confiável e habilitação explícita no backend.
        </p>
      )}
    </div>
  );
}
export function MissionHistoryView({
  missions,
  onDetails,
}: {
  missions: CommunityMission[];
  onDetails: (m: CommunityMission) => void;
}) {
  return missions.length ? (
    <div className="space-y-3">
      {missions.map((m) => (
        <MissionCard key={m.id} mission={m} onDetails={onDetails} />
      ))}
    </div>
  ) : (
    <p className="py-6 text-sm text-muted-foreground">
      Nenhuma missão concluída ou expirada registrada.
    </p>
  );
}
