import { TrendingUp, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { communityProgressPercent } from "@/lib/community-progression";
import type { CommunityProgression, CommunityXpEntry } from "@/types/community-progression";
const number = (n: number) => n.toLocaleString("pt-BR");
export function CommunityProgressionView({
  data,
  onHistory,
}: {
  data: CommunityProgression;
  onHistory?: (() => void) | undefined;
}) {
  const percent = communityProgressPercent(data);
  return (
    <section
      aria-label="Evolução da comunidade"
      className="rounded-2xl border border-primary/25 bg-surface p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-primary/10 p-3 text-primary">
            <TrendingUp className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Evolução coletiva
            </p>
            <h2 className="text-xl font-semibold">Nível {number(data.level)}</h2>
          </div>
        </div>
        {onHistory && (
          <Button variant="outline" size="sm" onClick={onHistory}>
            Histórico de XP
          </Button>
        )}
      </div>
      <div className="mb-2 mt-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {number(data.xp - data.level_floor)} / {number(data.next_level_xp - data.level_floor)} XP
          neste nível
        </span>
        <span>Nível {number(data.level + 1)}</span>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso do nível coletivo"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(percent)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {number(data.xp)} XP permanente · independente do nível dos membros
      </p>
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          {data.earning_enabled
            ? "Somente atividades verificadas pelo backend podem gerar XP."
            : "Ganhos automáticos desativados. A fundação está preparada; nenhuma fonte de participação foi habilitada."}{" "}
          Mensagens, tempo em chamadas e confirmação de presença não geram XP coletivo.
        </p>
      </div>
    </section>
  );
}
export function CommunityXpHistoryView({
  entries,
  onNext,
  onBack,
  canNext,
  busy,
}: {
  entries: CommunityXpEntry[];
  onNext: () => void;
  onBack: () => void;
  canNext: boolean;
  busy: boolean;
}) {
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Concessões verificadas e limites aplicados. Dados de evidência e identidades pessoais não
        são exibidos.
      </p>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Nenhuma concessão registrada.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">
                  {e.outcome === "granted" ? "Atividade verificada" : "Limite do período atingido"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-BR")} · registro {e.id} · política{" "}
                  {e.policy_revision}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-primary">+{number(e.awarded_xp)} XP</p>
                <p className="text-xs text-muted-foreground">Total: {number(e.total_after)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onBack} disabled={busy}>
          Voltar ao início
        </Button>
        <Button variant="outline" onClick={onNext} disabled={busy || !canNext}>
          Mais antigos
        </Button>
      </div>
    </section>
  );
}
