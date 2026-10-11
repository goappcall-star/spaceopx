import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ScreenShareSettings } from "@/components/voice/ScreenShareSettings";
import {
  ScreenShareController,
  DEFAULT_SCREEN_OPTIONS,
  type ScreenShareOptions,
} from "@/services/screen-share";
import "@/styles.css";

declare global {
  interface Window {
    screenV2Results?: unknown;
    screenV2Done?: boolean;
    screenBenchmarkPhase?: { round: number; enabled: boolean } | null;
    runScreenV2Benchmark?: () => Promise<void>;
  }
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function makeLink(stream: MediaStream) {
  const a = new RTCPeerConnection(),
    b = new RTCPeerConnection();
  a.onicecandidate = (e) => {
    if (e.candidate) void b.addIceCandidate(e.candidate).catch(() => {});
  };
  b.onicecandidate = (e) => {
    if (e.candidate) void a.addIceCandidate(e.candidate).catch(() => {});
  };
  const remote = document.querySelector<HTMLVideoElement>("#receiver")!;
  b.ontrack = (e) => {
    remote.srcObject = new MediaStream([e.track]);
    void remote.play().catch(() => {});
  };
  const sender = a.addTrack(stream.getVideoTracks()[0]!, stream);
  await a.setLocalDescription(await a.createOffer());
  await b.setRemoteDescription(a.localDescription!);
  await b.setLocalDescription(await b.createAnswer());
  await a.setRemoteDescription(b.localDescription!);
  const until = performance.now() + 10_000;
  while (a.connectionState !== "connected" && performance.now() < until) await wait(100);
  if (a.connectionState !== "connected") {
    a.close();
    b.close();
    throw Error("Local RTC did not connect");
  }
  return { sender, a, b };
}

function Fixture() {
  const [options, setOptions] = useState<ScreenShareOptions>({ ...DEFAULT_SCREEN_OPTIONS });
  const [controller] = useState(() => new ScreenShareController());
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Prévia técnica: sem conta, servidor ou mensagens reais.");
  const [results, setResults] = useState<unknown>(null);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    window.screenV2Done = false;
    const canvas = document.querySelector<HTMLCanvasElement>("#source")!;
    const ctx = canvas.getContext("2d")!;
    let frame = 0,
      drawTimer: ReturnType<typeof setTimeout> | null = null,
      previous = performance.now();
    const intervals: number[] = [];
    const draw = () => {
      const now = performance.now();
      intervals.push(now - previous);
      previous = now;
      frame++;
      ctx.fillStyle = "#10152d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = i % 2 ? "#28cbd7" : "#8845ff";
        ctx.fillRect((frame * 12 + i * 80) % canvas.width, (i * 50) % canvas.height, 90, 30);
      }
      ctx.fillStyle = "white";
      ctx.font = "48px sans-serif";
      ctx.fillText(`LobbyX · movimento sintético · ${frame}`, 40, 100);
      drawTimer = setTimeout(draw, 1000 / 60);
    };
    const rows: unknown[] = [];
    let stream: MediaStream | null = null;
    let link: Awaited<ReturnType<typeof makeLink>> | null = null;
    try {
      canvas.width = 1920;
      canvas.height = 1080;
      draw();
      stream = canvas.captureStream(30);
      link = await makeLink(stream);
      const track = stream.getVideoTracks()[0]!;
      controller.start(track, DEFAULT_SCREEN_OPTIONS, false);
      controller.attach(link.sender);
      await wait(2000);
      controller.stop();
      for (let round = 0; round < 3; round++)
        for (const enabled of round % 2 ? [true, false] : [false, true]) {
          setMessage(
            `Benchmark local ${round + 1}/3 · controlador ${enabled ? "ligado" : "desligado"}`,
          );
          window.screenBenchmarkPhase = { round, enabled };
          const before = intervals.length;
          const memoryBefore = (performance as any).memory?.usedJSHeapSize ?? null;
          if (enabled) {
            controller.start(track, DEFAULT_SCREEN_OPTIONS, false);
            controller.attach(link.sender);
          } else controller.stop();
          const t = performance.now();
          await wait(8500);
          const values = intervals.slice(before).sort((a, b) => a - b);
          rows.push({
            round,
            enabled,
            durationMs: performance.now() - t,
            frames: values.length,
            frameIntervalP50: values[Math.floor(values.length * 0.5)],
            frameIntervalP95: values[Math.floor(values.length * 0.95)],
            jsHeapBefore: memoryBefore,
            jsHeapAfter: (performance as any).memory?.usedJSHeapSize ?? null,
            stats: enabled ? controller.getSnapshot() : null,
          });
        }
      window.screenBenchmarkPhase = null;
      controller.stop();
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
      link.a.close();
      link.b.close();
      link = null;
      // CaptureStream is a synthetic source, not proof of getDisplayMedia support.
      for (const resolution of [720, 1080, 1440] as const)
        for (const fps of [15, 30, 60] as const) {
          setMessage(`Codificação local sintética · ${resolution}p / ${fps} FPS`);
          canvas.height = resolution;
          canvas.width = Math.round((resolution * 16) / 9);
          stream = canvas.captureStream(fps);
          link = await makeLink(stream);
          controller.start(
            stream.getVideoTracks()[0]!,
            { ...DEFAULT_SCREEN_OPTIONS, resolution, fps },
            false,
          );
          controller.attach(link.sender);
          await wait(1800);
          await controller.sample();
          await wait(1800);
          await controller.sample();
          rows.push({ resolution, fps, synthetic: true, snapshot: controller.getSnapshot() });
          controller.stop();
          stream.getTracks().forEach((t) => t.stop());
          stream = null;
          link.a.close();
          link.b.close();
          link = null;
        }
      const output = {
        platform: navigator.userAgent,
        kind: "synthetic local RTC, timer-driven canvas, no real capture or cross-client/audio validation",
        rows,
      };
      window.screenV2Results = output;
      setResults(output);
      setMessage("Benchmark concluído. Resultados reais do teste sintético abaixo.");
    } catch (error) {
      const output = { error: error instanceof Error ? error.message : "unknown", rows };
      window.screenV2Results = output;
      setResults(output);
      setMessage("Teste incompleto: consulte os resultados.");
    } finally {
      if (drawTimer) clearTimeout(drawTimer);
      controller.stop();
      stream?.getTracks().forEach((t) => t.stop());
      link?.a.close();
      link?.b.close();
      setBusy(false);
      setActive(false);
      window.screenV2Done = true;
      window.screenBenchmarkPhase = null;
    }
  };
  window.runScreenV2Benchmark = run;
  const liveUpdate = async () => {
    setBusy(true);
    const canvas = document.querySelector<HTMLCanvasElement>("#source")!;
    canvas.width = 1920; canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;
    const timer = setInterval(() => { ctx.fillStyle = frame++ % 2 ? "#19c4d4" : "#8645ff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }, 40);
    const stream = canvas.captureStream(30);
    let link: Awaited<ReturnType<typeof makeLink>> | null = null;
    try {
      link = await makeLink(stream);
      const track = stream.getVideoTracks()[0]!;
      controller.start(track, DEFAULT_SCREEN_OPTIONS, false); controller.attach(link.sender);
      await wait(2500);
      await controller.update({ resolution: 720, fps: 15, mode: "performance", audio: false });
      await wait(2500); await controller.sample();
      const result = { kind: "live synthetic RTC update, not display capture", connected: link.a.connectionState === "connected", sameTrack: link.sender.track === track, trackLive: track.readyState === "live", transceivers: link.a.getTransceivers().length, snapshot: controller.getSnapshot() };
      setResults(result); setMessage("Ajuste ao vivo conferido. Resultados técnicos abaixo.");
    } catch (error) { setResults({ error: error instanceof Error ? error.message : "unknown" }); }
    finally { clearInterval(timer); controller.stop(); stream.getTracks().forEach(track => track.stop()); link?.a.close();link?.b.close();setBusy(false); }
  };
  useEffect(() => {
    if (new URLSearchParams(location.search).get("autorun") === "1") {
      const timer = setTimeout(() => void run(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, []);
  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 text-foreground">
      <header className="flex flex-wrap justify-between gap-2">
        <h1 className="font-bold">LobbyX · Compartilhamento V2</h1>
        <button onClick={() => document.documentElement.classList.toggle("light")}>
          Alternar tema
        </button>
      </header>
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-background p-5">
          <ScreenShareSettings
            active={active}
            busy={busy}
            options={options}
            onOptions={setOptions}
            performanceMode={true}
            controller={controller}
            onConfirm={() =>
              setMessage(
                `Seleção conferida: ${options.resolution}p / ${options.fps} FPS / ${options.mode}. Prévia não captura a tela.`,
              )
            }
            onStop={() => setActive(false)}
          />
        </section>
        <section className="space-y-3">
          <button disabled={busy} className="rounded-lg border border-border px-4 py-2" onClick={() => void liveUpdate()}>Testar ajuste ao vivo</button>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            disabled={busy}
            onClick={() => void run()}
          >
            Executar benchmark sintético
          </button>
          <canvas id="source" className="w-full rounded-xl" />
          <video id="receiver" autoPlay muted playsInline className="w-full rounded-xl" />
        </section>
      </div>
      {results !== null && (
        <pre className="max-h-96 overflow-auto rounded-lg bg-secondary p-3 text-xs">
          {JSON.stringify(results, null, 2)}
        </pre>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
