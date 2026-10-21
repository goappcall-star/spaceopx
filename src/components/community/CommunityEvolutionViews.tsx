import { Button } from "@/components/ui/button";
import { CommunityIdentity } from "./CommunityAppearance";
import type {
  CommunityStatistics,
  CommunityCosmetics,
  CommunityCosmetic,
  Appearance,
} from "@/types/community-evolution";
export function CommunityStatisticsView({
  data,
  days,
  onPeriod,
  onNext,
  onFirst,
  busy,
}: {
  data: CommunityStatistics;
  days: number;
  onPeriod: (n: number) => void;
  onNext: () => void;
  onFirst: () => void;
  busy: boolean;
}) {
  const max = Math.max(1, ...data.daily.map((d) => d.xp));
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Comunidade → Estatísticas</h2>
        <label className="text-sm">
          Período UTC{" "}
          <select
            aria-label="Período das estatísticas"
            className="ml-2 rounded-lg border border-border bg-background p-2"
            value={days}
            disabled={busy}
            onChange={(e) => onPeriod(Number(e.target.value))}
          >
            {[7, 30, 90].map((n) => (
              <option key={n} value={n}>
                Últimos {n} dias
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        De {data.from} até {data.to} (fim exclusivo). Agregados reais; eventos respeitam o acesso
        aos canais.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Nível atual", data.progression.level],
          ["XP atual", data.progression.xp],
          ["XP no período", data.xp_received],
          ["Missões concluídas", data.missions_completed],
          ["Conquistas no período", data.achievements_unlocked],
          ["Membros atuais", data.members_current],
          ["Eventos criados", data.events_created],
          ["Eventos agendados", data.events_scheduled],
          ["Cancelados · alteração no período", data.events_cancelled],
          ["Intenções atuais de participar", data.rsvp_going],
        ].map(([label, n]) => (
          <div key={String(label)} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {typeof n === "number" ? n.toLocaleString("pt-BR") : n}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border p-5">
        <h3 className="font-semibold">XP recebido por dia</h3>
        {data.daily.length ? (
          <div
            className="mt-4 flex h-36 items-end gap-1 overflow-x-auto"
            role="img"
            aria-label="Barras de XP recebido por dia em UTC"
          >
            {data.daily.map((d) => (
              <div
                key={d.day}
                className="flex h-full min-w-6 flex-1 flex-col justify-end"
                title={`${d.day}: ${d.xp} XP; saldo ${d.balance}`}
              >
                <span className="mb-1 text-center text-[10px] text-muted-foreground">{d.xp}</span>
                <div
                  className="min-h-px rounded-t bg-primary"
                  style={{ height: `${(100 * d.xp) / max}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhuma concessão registrada neste período.
          </p>
        )}
      </div>
      <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
        Crescimento histórico, eventos efetivamente realizados e presença comprovada: indisponíveis
        por falta de histórico/verificação confiáveis. Agendamento não comprova realização; RSVP
        representa intenção atual, não comparecimento.
      </p>
      <div>
        <h3 className="mb-3 font-semibold">Histórico de XP no período</h3>
        {data.history.length ? (
          <ul className="divide-y divide-border">
            {data.history.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                <span>
                  +{e.awarded_xp} XP · saldo {e.total_after}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sem registros.</p>
        )}
        <div className="mt-4 flex justify-between">
          <Button variant="outline" onClick={onFirst} disabled={busy}>
            Voltar ao início
          </Button>
          <Button variant="outline" onClick={onNext} disabled={busy || data.history.length !== 20}>
            Mais antigos
          </Button>
        </div>
      </div>
    </section>
  );
}
export function CommunityCosmeticsView({
  data,
  preview,
  onPreview,
  onEquip,
  busy,
}: {
  data: CommunityCosmetics;
  preview: Appearance;
  onPreview: (a: Appearance) => void;
  onEquip: (item: CommunityCosmetic | null, slot: CommunityCosmetic["slot"]) => void;
  busy: boolean;
}) {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-semibold">Personalização da comunidade</h2>
      <CommunityIdentity appearance={preview} name="Prévia da comunidade" />
      <p className="text-xs text-muted-foreground">
        A prévia não salva alterações. Remover um cosmético revela o tema e banner originais, que
        permanecem preservados.
      </p>
      <Button variant="outline" onClick={() => onPreview(data.equipped)}>
        Restaurar prévia aplicada
      </Button>
      <div className="grid gap-3 md:grid-cols-2">
        {data.items.map((i) => (
          <article key={i.id} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <h3 className="font-semibold">{i.name}</h3>
            <p className="text-sm text-muted-foreground">{i.description}</p>
            <p className="text-xs text-muted-foreground">
              {i.available
                ? "Desbloqueado e disponível"
                : i.requires_mission
                  ? "Bloqueado · exige missão e verificador habilitados"
                  : i.owned
                    ? "Seleção indisponível"
                    : "Bloqueado · sem desbloqueio comprovado"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPreview({ ...preview, [i.slot]: i.render_key })}
              >
                Prévia
              </Button>
              <Button
                size="sm"
                disabled={
                  busy || !data.can_manage || !i.available || data.selection[i.slot] === i.id
                }
                onClick={() => onEquip(i, i.slot)}
              >
                Aplicar
              </Button>
              {data.selection[i.slot] === i.id && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !data.can_manage}
                  onClick={() => onEquip(null, i.slot)}
                >
                  Remover seleção
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
