import { ChartColumn, Palette, Image, Stamp, Frame, Sparkles } from "lucide-react";
import {
  CommunityHeading,
  CommunitySection,
  CommunityNotice,
  CommunityEmpty,
  CommunityActions,
} from "./CommunityUI";
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
  const metrics = [
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
  ];
  return (
    <section className="community-ui space-y-5">
      <CommunityHeading
        icon={ChartColumn}
        eyebrow="Evolução em números"
        title="Estatísticas da comunidade"
        description="Acompanhe o que foi registrado, sem estimativas de atividade ou presença."
      >
        <label className="text-xs text-muted-foreground">
          Período UTC
          <select
            aria-label="Período das estatísticas"
            className="ml-2 rounded-lg border border-border bg-background p-2 text-sm text-foreground"
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
      </CommunityHeading>
      <p className="text-xs text-muted-foreground">
        De {data.from} até {data.to} (fim exclusivo). Eventos respeitam o acesso aos canais.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map(([label, n], index) => (
          <div
            key={String(label)}
            className={"community-section " + (index < 3 ? "community-metric-main" : "")}
          >
            <p className="text-xs leading-relaxed text-muted-foreground">{label}</p>
            <p
              className={
                "mt-3 font-semibold tracking-tight " + (index < 3 ? "text-3xl" : "text-2xl")
              }
            >
              {typeof n === "number" ? n.toLocaleString("pt-BR") : n}
            </p>
          </div>
        ))}
      </div>
      <CommunitySection
        title="XP recebido por dia"
        description="Concessões registradas no ledger, agrupadas em UTC. Cada barra representa um dia com registros."
      >
        {data.daily.length ? (
          <>
            <svg
              viewBox="0 0 640 160"
              role="img"
              aria-label="Barras de XP recebido por dia em UTC"
              className="h-40 w-full"
            >
              <line
                x1="0"
                x2="640"
                y1="159"
                y2="159"
                stroke="currentColor"
                className="text-border"
              />
              {data.daily.map((d, i) => {
                const w = 640 / data.daily.length,
                  h = (135 * d.xp) / max;
                return (
                  <rect
                    key={d.day}
                    x={i * w + Math.min(3, w / 8)}
                    y={159 - h}
                    width={w - Math.min(6, w / 4)}
                    height={Math.max(1, h)}
                    rx={Math.min(4, w / 4)}
                    fill="currentColor"
                    className="text-primary"
                  >
                    <title>
                      {d.day}: {d.xp} XP; saldo {d.balance}
                    </title>
                  </rect>
                );
              })}
            </svg>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{data.daily[0]?.day}</span>
              <span>{data.daily.at(-1)?.day}</span>
            </div>
            <details className="mt-4 border-t border-border">
              <summary>Ver valores por dia</summary>
              <ul className="max-h-48 overflow-y-auto divide-y divide-border">
                {data.daily.map((d) => (
                  <li key={d.day} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
                    <span>{d.day} · UTC</span>
                    <span>
                      {d.xp.toLocaleString("pt-BR")} XP · saldo {d.balance.toLocaleString("pt-BR")}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        ) : (
          <CommunityEmpty
            icon={ChartColumn}
            title="Ainda não há concessões neste período"
            description="Escolha outro intervalo. Nível e XP atuais continuam representando o saldo permanente da comunidade."
          />
        )}
      </CommunitySection>
      <CommunityNotice>
        Crescimento histórico, eventos efetivamente realizados e presença comprovada: indisponíveis
        por falta de histórico/verificação confiáveis. Agendamento não comprova realização; RSVP
        representa intenção atual, não comparecimento.
      </CommunityNotice>
      <CommunitySection
        title="Histórico de XP no período"
        description="Registros de concessão e saldo após cada operação."
      >
        {data.history.length ? (
          <ul className="divide-y divide-border">
            {data.history.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </span>
                <span>
                  +{e.awarded_xp} XP{" "}
                  <span className="ml-2 text-xs text-muted-foreground">saldo {e.total_after}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sem registros.</p>
        )}
        <CommunityActions>
          <Button variant="outline" onClick={onFirst} disabled={busy}>
            Voltar ao início
          </Button>
          <Button variant="outline" onClick={onNext} disabled={busy || data.history.length !== 20}>
            Mais antigos
          </Button>
        </CommunityActions>
      </CommunitySection>
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
  const names = {
    theme: "Tema",
    banner: "Banner",
    seal: "Selo",
    frame: "Moldura",
    highlight: "Destaque",
  };
  const icons = { theme: Palette, banner: Image, seal: Stamp, frame: Frame, highlight: Sparkles };
  return (
    <section className="community-ui space-y-5">
      <CommunityHeading
        icon={Palette}
        eyebrow="Coleção da comunidade"
        title="Personalização da comunidade"
        description="Escolha detalhes que representam sua trajetória. Teste uma combinação antes de aplicar."
      />
      <div className="community-editor-grid">
        <div className="grid gap-3 sm:grid-cols-2">
          {data.items.map((i) => {
            const Icon = icons[i.slot],
              selected = data.selection[i.slot] === i.id;
            return (
              <article
                key={i.id}
                className={
                  "community-section flex flex-col gap-3 " + (selected ? "border-primary" : "")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="community-icon">
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <span className="rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground">
                    {selected ? "Aplicado" : i.available ? "Disponível" : "Bloqueado"}
                  </span>
                </div>
                <div>
                  <p className="community-eyebrow">{names[i.slot]}</p>
                  <h3 className="font-semibold">{i.name}</h3>
                </div>
                <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
                  {i.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i.available
                    ? "Desbloqueado e disponível"
                    : i.requires_mission
                      ? "Bloqueado · exige missão e verificador habilitados"
                      : i.owned
                        ? "Seleção indisponível"
                        : "Bloqueado · sem desbloqueio comprovado"}
                </p>
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPreview({ ...preview, [i.slot]: i.render_key })}
                  >
                    Prévia
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || !data.can_manage || !i.available || selected}
                    onClick={() => onEquip(i, i.slot)}
                  >
                    Aplicar
                  </Button>
                  {selected && (
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
            );
          })}
        </div>
        <aside className="community-editor-preview space-y-4" aria-label="Prévia de cosméticos">
          <p className="community-eyebrow">Sua combinação</p>
          <CommunityIdentity appearance={preview} name="Prévia da comunidade" />
          <CommunityNotice>
            A prévia não salva alterações. Remover um cosmético revela o tema e banner originais,
            que permanecem preservados. Itens bloqueados podem ser visualizados, mas não aplicados.
          </CommunityNotice>
          <Button variant="outline" onClick={() => onPreview(data.equipped)}>
            Restaurar prévia aplicada
          </Button>
        </aside>
      </div>
    </section>
  );
}
