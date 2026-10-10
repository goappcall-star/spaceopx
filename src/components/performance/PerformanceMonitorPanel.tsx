import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { aggregate, METRICS, type MetricRow } from "@/services/performance/core.mjs";
import {
  alertEvaluator,
  clearMetrics,
  metrics,
  setMonitorEnabled,
} from "@/services/performance/monitor";

const WINDOWS = {
  "5 minutos": 300000,
  "1 hora": 3600000,
  "24 horas": 86400000,
  "7 dias": 604800000,
};
const DEFAULT_LIMITS = {
  "backend.unread": 1500,
  "ui.navigation": 700,
  "ui.frame": 50,
  "rtc.rtt": 250,
  "runtime.memory": 1000,
};
type Alert = ReturnType<typeof alertEvaluator.evaluate>[number];
export function PerformanceMonitorPanel({ onBack }: { onBack?: () => void }) {
  const [rows, setRows] = useState<MetricRow[]>(() => metrics.snapshot());
  const [enabled, setEnabled] = useState(metrics.enabled);
  const [windowMs, setWindowMs] = useState(300000);
  const [platform, setPlatform] = useState("all");
  const [version, setVersion] = useState("all");
  const [mode, setMode] = useState("all");
  const [feature, setFeature] = useState("all");
  const [limits, setLimits] = useState<Record<string, number>>(DEFAULT_LIMITS);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  useEffect(() => {
    const refresh = () => {
      if (document.hidden) return;
      setEnabled(metrics.enabled);
      const next = metrics.snapshot();
      setRows(next);
      const notices = alertEvaluator.evaluate(next, limits);
      if (notices.length) setAlerts((prev) => [...notices, ...prev].slice(0, 20));
    };
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [limits]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.minute >= Date.now() - windowMs &&
          (platform === "all" || r.platform === platform) &&
          (version === "all" || r.version === version) &&
          (mode === "all" || r.mode === mode) &&
          (feature === "all" || r.metric === feature),
      ),
    [rows, windowMs, platform, version, mode, feature],
  );
  const summaries = aggregate(filtered);
  const selectClass = "rounded-md border border-input bg-background px-3 py-2 text-sm max-w-full";
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 text-foreground sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Monitor</h1>
          <p className="text-sm text-muted-foreground">
            V1.1 • medições reais deste dispositivo • histórico agregado desta sessão
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={enabled ? "secondary" : "default"}
            onClick={() => {
              setMonitorEnabled(!enabled);
              setEnabled(metrics.enabled);
            }}
          >
            {enabled ? "Pausar coleta" : "Ativar coleta local"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              clearMetrics();
              setRows([]);
              setAlerts([]);
            }}
          >
            Limpar histórico local
          </Button>
          <Button variant="outline" onClick={onBack}>
            Voltar ao LobbyX
          </Button>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Nenhuma mídia, mensagem, nome, ID de usuário, endereço IP ou token é coletado. Sem envio de
        métricas ao Supabase. P50/P95 são limites superiores aproximados de histogramas; HTTP mede
        rede + serviço, sem atribuir a causa ao backend. Memória/CPU do aplicativo completo exigem
        Electron atualizado; heap WEB e long tasks dependem do navegador.
      </div>
      <p className="text-xs text-muted-foreground">
        Atualização do painel: 10 s. Recursos: 60 s; WebRTC: 30 s; RAF: 1 s a cada 2 min. CPU
        precisa de duas amostras comparáveis; indisponibilidade não é consumo zero. CPU representa a
        soma dos processos em % de um núcleo lógico. CPU/RAM do app:{" "}
        {typeof window !== "undefined" && window.lobbyxDesktop?.performance
          ? "disponíveis via Electron"
          : "indisponíveis neste ambiente"}
        . GPU%: indisponível nesta V1. Renderização: intervalos RAF amostrados e long tasks, quando
        suportados.
      </p>
      <div className="flex flex-wrap gap-3">
        <select
          aria-label="Janela de histórico"
          className={selectClass}
          value={windowMs}
          onChange={(e) => setWindowMs(Number(e.target.value))}
        >
          {Object.entries(WINDOWS).map(([label, value]) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Plataforma"
          className={selectClass}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="all">Todas as plataformas</option>
          <option value="web">WEB</option>
          <option value="electron">Electron</option>
        </select>
        <select
          aria-label="Versão"
          className={selectClass}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        >
          <option value="all">Todas as versões</option>
          {[...new Set(rows.map((r) => r.version))].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          aria-label="Modo visual"
          className={selectClass}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="all">Todos os modos</option>
          <option value="normal">Normal</option>
          <option value="optimized">Otimizado</option>
          <option value="maximum">Desempenho Máximo</option>
        </select>
        <select
          aria-label="Funcionalidade"
          className={selectClass}
          value={feature}
          onChange={(e) => setFeature(e.target.value)}
        >
          <option value="all">Todas as funcionalidades</option>
          {Object.keys(METRICS).map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      {!summaries.length && (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Sem amostras nesta seleção. Ative a coleta e use o LobbyX; gráficos não recebem dados
          fictícios.
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((r) => (
          <section key={r.metric} className="min-w-0 rounded-xl border bg-card p-4">
            <h2 className="break-words font-semibold">
              {r.metric}{" "}
              <span className="font-normal text-muted-foreground">({METRICS[r.metric]})</span>
            </h2>
            <p className="mt-2 text-2xl font-bold">
              {r.mean.toFixed(2)} <span className="text-xs font-normal">média</span>
            </p>
            <p className="text-sm text-muted-foreground">
              P50 ≤ {r.p50} · P95 ≤ {r.p95} · n={r.count}
              <br />
              Erros: {(r.errorRate * 100).toFixed(1)}% · máx.: {r.max.toFixed(2)}
            </p>
            <MetricChart rows={filtered.filter((v) => v.metric === r.metric)} />
          </section>
        ))}
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Alertas locais</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Limites na unidade da métrica, desta sessão. Mínimo de 5 amostras em 2 minutos distintos;
          intervalo de 5 minutos entre alertas da mesma métrica. Nenhuma notificação externa.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(limits).map(([metric, value]) => (
            <label key={metric} className="text-sm">
              {metric}
              <Input
                type="number"
                min={1}
                max={1000000}
                value={value}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 1 && v <= 1000000)
                    setLimits((prev) => ({ ...prev, [metric]: v }));
                }}
              />
            </label>
          ))}
        </div>
        {alerts.length ? (
          <ul className="mt-4 space-y-2">
            {alerts.map((a) => (
              <li
                key={a.metric + a.time}
                className="rounded-md border border-amber-500/40 p-2 text-sm"
              >
                {new Date(a.time).toLocaleTimeString()} — {a.metric}: P95 ≤ {a.p95}; erros{" "}
                {(a.errorRate * 100).toFixed(1)}%. Investigar antes de atribuir uma causa.
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nenhum alerta com evidência suficiente.
          </p>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        Retenção máxima: 7 dias ou 2.048 agregados, o que ocorrer primeiro. Ao recarregar, sair ou
        trocar de conta, o histórico é apagado. Falta de amostras não significa ausência de falhas.
        Regressões entre versões e tendência de memória ainda exigem ensaios controlados.
      </p>
    </main>
  );
}
function MetricChart({ rows }: { rows: MetricRow[] }) {
  const byMinute = new Map<number, { sum: number; count: number }>();
  for (const r of rows) {
    const p = byMinute.get(r.minute) ?? { sum: 0, count: 0 };
    p.sum += r.sum;
    p.count += r.count;
    byMinute.set(r.minute, p);
  }
  const points = [...byMinute].sort((a, b) => a[0] - b[0]);
  const values = points.map(([, v]) => v.sum / v.count);
  const max = Math.max(1, ...values);
  const first = points[0]?.[0] ?? 0,
    last = points.at(-1)?.[0] ?? first;
  // Only observed minute aggregates; a single sample is a point, never a fake series.
  return (
    <svg
      role="img"
      aria-label="Médias por minuto observado"
      viewBox="0 0 300 80"
      className="mt-3 h-20 w-full text-primary"
    >
      {points.map(([time], i) => (
        <circle
          key={time}
          cx={10 + (280 * (time - first)) / Math.max(60000, last - first)}
          cy={70 - (60 * values[i]!) / max}
          r="3"
          fill="currentColor"
        >
          <title>
            {new Date(time).toLocaleString()}: {values[i]!.toFixed(2)}
          </title>
        </circle>
      ))}
    </svg>
  );
}
