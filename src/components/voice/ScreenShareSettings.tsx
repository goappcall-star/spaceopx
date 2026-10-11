import { useState, useSyncExternalStore } from "react";
import { Monitor, Gauge, Radio, Volume2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScreenShareOptions, ScreenShareController } from "@/services/screen-share";
const display = (n: number | null, suffix = "") =>
  n === null ? "Indisponível" : `${Math.round(n)}${suffix}`;
export function ScreenShareMetrics({ controller }: { controller: ScreenShareController }) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  if (!snapshot.active) return null;
  return (
    <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3 text-xs">
      <p className="font-semibold">Captura e transmissão reais</p>
      <p>
        Captura: {snapshot.capture?.width ?? "?"} × {snapshot.capture?.height ?? "?"} ·{" "}
        {display(snapshot.capture?.fps ?? null, " FPS reportados pela captura")}
      </p>
      <p>Áudio capturado: {snapshot.capture?.audio ? "Sim" : "Não disponível / desativado"}</p>
      {!snapshot.peers.length && (
        <p className="text-muted-foreground">
          Aguardando destinatários; ainda não há vídeo transmitido para medir.
        </p>
      )}
      {snapshot.peers.map((peer, i) => (
        <div key={i} className="border-t border-border pt-2">
          <p>
            Destino {i + 1}: {peer.width ?? "?"} × {peer.height ?? "?"} ·{" "}
            {display(peer.fps, " FPS codificados")}
          </p>
          <p>
            {display(peer.bitrate === null ? null : peer.bitrate / 1000, " kbps")} · perda{" "}
            {peer.loss === null ? "indisponível" : `${(peer.loss * 100).toFixed(1)}%`} · RTT{" "}
            {display(peer.rtt === null ? null : peer.rtt * 1000, " ms")}
          </p>
          <p className="text-muted-foreground">
            {peer.codec ?? "Codec aguardando negociação"} ·{" "}
            {peer.encoder ?? "Codificador não informado"} · limitação{" "}
            {peer.limitation ?? "indisponível"}
          </p>
        </div>
      ))}
      <p className="text-muted-foreground">
        Dados locais, amostrados a cada 4–10 s. FPS da captura é o reportado por getSettings; FPS
        codificado mede a saída WebRTC, sem garantir o FPS exibido pelo destinatário.
      </p>
    </div>
  );
}

function ScreenShareWarning({ controller }: { controller: ScreenShareController }) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  return snapshot.warning ? (
    <p role="alert" className="rounded-lg border border-warning/30 p-3 text-xs text-warning">
      {snapshot.warning}
    </p>
  ) : null;
}

export function ScreenShareSettings({
  active,
  busy,
  options,
  onOptions,
  performanceMode,
  controller,
  onConfirm,
  onStop,
}: {
  active: boolean;
  busy: boolean;
  options: ScreenShareOptions;
  onOptions: (next: ScreenShareOptions) => void;
  performanceMode: boolean;
  controller: ScreenShareController | null;
  onConfirm: () => void;
  onStop: () => void;
}) {
  const [metrics, setMetrics] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/10 p-4">
        <Monitor className="h-8 w-8 shrink-0 text-primary" />
        <div>
          <p className="font-semibold">Tela ou janela</p>
          <p className="text-xs text-muted-foreground">
            {active
              ? "Fonte atual preservada. Para trocar a fonte ou o áudio, encerre esta transmissão e selecione novamente."
              : "Ao continuar, escolha a fonte no seletor seguro do navegador ou do LobbyX Desktop."}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-2 text-sm">
          <span className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Resolução desejada
          </span>
          <select
            aria-label="Resolução desejada"
            disabled={busy}
            value={options.resolution}
            onChange={(e) =>
              onOptions({
                ...options,
                resolution: Number(e.target.value) as ScreenShareOptions["resolution"],
              })
            }
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          >
            {[720, 1080, 1440].map((n) => (
              <option key={n} value={n}>
                {n}p
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            FPS desejado
          </span>
          <select
            aria-label="FPS desejado"
            disabled={busy}
            value={options.fps}
            onChange={(e) =>
              onOptions({ ...options, fps: Number(e.target.value) as ScreenShareOptions["fps"] })
            }
            className="h-11 w-full rounded-lg border border-input bg-background px-3"
          >
            {[15, 30, 60].map((n) => (
              <option key={n} value={n}>
                {n} FPS
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset disabled={busy} className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Prioridade da transmissão</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["auto", "Automático"],
              ["performance", "Desempenho"],
              ["quality", "Qualidade"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              variant={options.mode === value ? "default" : "outline"}
              className="px-1 text-xs"
              aria-pressed={options.mode === value}
              onClick={() => onOptions({ ...options, mode: value })}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {options.mode === "quality"
            ? "Prioriza detalhes. Em rede limitada, o FPS pode diminuir."
            : options.mode === "performance"
              ? "Prioriza movimento fluido, reduz a resolução sob pressão e sonda métricas com menor frequência."
              : "Equilibra qualidade e fluidez, com adaptação por destinatário."}
        </p>
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <Volume2 className="h-4 w-4" />
        <input
          type="checkbox"
          disabled={busy || active}
          checked={options.audio}
          onChange={(e) => onOptions({ ...options, audio: e.target.checked })}
        />
        Compartilhar áudio da fonte
      </label>
      <p className="text-xs text-muted-foreground">
        WEB: áudio depende do navegador, sistema e fonte escolhida. Desktop Windows: áudio do
        sistema, quando permitido no seletor. A captura pode incluir outros aplicativos; confirme a
        fonte antes de iniciar.
      </p>
      {performanceMode && (
        <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-xs">
          <Zap className="h-4 w-4 shrink-0" />
          Modo Desempenho ativo: recomendamos 720p / 30 FPS. 1440p e 60 FPS continuam disponíveis,
          mas aumentam o custo de captura e envio para cada participante.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Até 60 FPS, conforme fonte, codificador e rede. A aceleração de hardware depende do
        navegador e dos drivers; o codec é negociado com cada participante.
      </p>
      {active && controller && <ScreenShareWarning controller={controller} />}
      {active && controller && (
        <>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={metrics}
              onChange={(e) => setMetrics(e.target.checked)}
            />
            Mostrar estatísticas técnicas
          </label>
          {metrics && <ScreenShareMetrics controller={controller} />}
        </>
      )}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {active && (
          <Button disabled={busy} variant="destructive" onClick={onStop}>
            Parar transmissão
          </Button>
        )}
        <Button disabled={busy} onClick={onConfirm}>
          {busy ? "Aguarde…" : active ? "Aplicar qualidade" : "Selecionar fonte e transmitir"}
        </Button>
      </div>
    </div>
  );
}
