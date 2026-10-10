import {
  metrics,
  setMonitorEnabled,
  sampleMonitorNow,
} from "../../src/services/performance/monitor";
import { Profiler, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { IllustratedFrame } from "../../src/components/gamer/IllustratedFrame";
import { FlamingCutFrame } from "../../src/components/gamer/FlamingCutFrame";
import { VisualQualitySync, setVisualQuality } from "../../src/hooks/use-visual-quality";
import { UnreadBadge } from "../../src/components/app/UnreadBadge";
import { createVoiceProvider } from "../../src/services/voice";
import "../../src/styles.css";

const monitorOn = new URLSearchParams(location.search).get("monitor") === "on";
const sustained = new URLSearchParams(location.search).has("sustained");
setMonitorEnabled(monitorOn);
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
interface AuditReport {
  scope: string;
  userAgent: string;
  samples: unknown[];
  rtc: unknown[];
  rtcError?: string;
  finishedAt?: string;
  [key: string]: unknown;
}
const report: AuditReport = {
  scope:
    "Isolated production-built fixture: real frame components and MeshVoiceProvider; synthetic audio/video; in-memory signaling, no Supabase/STUN/microphone",
  userAgent: navigator.userAgent,
  samples: [],
  rtc: [],
};
const samples = report.samples as unknown[];
let start: (() => Promise<void>) | undefined;
let commits = 0;
function App() {
  const [count, setCount] = useState(10);
  const [revision, setRevision] = useState(0);
  const [running, setRunning] = useState(false);
  useLayoutEffect(() => {
    start = async () => {
      setRunning(true);
      document.documentElement.dataset["auditPhase"] = "visual";
      for (const mode of ["normal"] as const) {
        setVisualQuality(mode);
        for (const users of [10, 50, 100]) {
          document.documentElement.dataset["auditUsers"] = String(users);
          const renderMs: number[] = [];
          flushSync(() => setCount(users));
          await pause(800);
          for (let i = 0; i < 20; i++) {
            const before = performance.now();
            flushSync(() => setRevision((r) => r + 1));
            renderMs.push(performance.now() - before);
            await pause(30);
          }
          let pathWrites = 0;
          const observer = new MutationObserver((records) => {
            pathWrites += records.length;
          });
          observer.observe(document.getElementById("profiles")!, {
            subtree: true,
            attributes: true,
            attributeFilter: ["d"],
          });
          const frames: number[] = [];
          let last = 0,
            raf = 0;
          const tick = (time: number) => {
            if (last) frames.push(time - last);
            last = time;
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          const heapBefore = (performance as unknown as { memory?: { usedJSHeapSize: number } })
            .memory?.usedJSHeapSize;
          await pause(3000);
          cancelAnimationFrame(raf);
          observer.disconnect();
          samples.push({
            mode,
            users,
            renderMs,
            frameIntervalsMs: frames,
            pathWrites,
            commits,
            nodes: document.querySelectorAll("*").length,
            runningAnimations: document.getAnimations().filter((a) => a.playState === "running")
              .length,
            visible: !document.hidden,
            heapBefore,
            heapAfter: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
              ?.usedJSHeapSize,
          });
        }
      }
      try {
        for (const quality of ["normal"] as const) {
          setVisualQuality(quality);
          await rtcBenchmark(quality);
        }
      } catch (error) {
        report.rtcError = String(error);
      }
      document.documentElement.dataset["auditPhase"] = "done";
      report.finishedAt = new Date().toISOString();
      report.monitorOn = monitorOn;
      report.monitorRows = metrics.snapshot();
      setMonitorEnabled(false);
      document.getElementById("results")!.textContent = JSON.stringify(report, null, 2);
      setRunning(false);
    };
    if (new URLSearchParams(location.search).has("auto")) queueMicrotask(() => void start?.());
  }, []);
  return (
    <>
      <VisualQualitySync />
      <header className="sticky top-0 z-50 bg-background p-3">
        <h1>Auditoria local — componentes reais, dados fictícios</h1>
        <button
          disabled={running}
          onClick={() => void start?.()}
          className="bg-primary rounded px-4 py-2"
        >
          {running ? "Medindo…" : "Executar medições"}
        </button>
        <span className="ml-4">
          {count} perfis · atualização {revision}
        </span>
      </header>
      <pre id="results" className="p-3">
        Aguardando
      </pre>
      <Profiler
        id="profiles"
        onRender={() => {
          commits++;
        }}
      >
        <div id="profiles" className="flex flex-wrap gap-8 p-10">
          {Array.from({ length: count }, (_, i) => (
            <article
              key={i}
              className="bg-surface relative rounded-3xl p-6"
              style={{ width: 190, height: 245 }}
            >
              <h2>Usuário fictício {i + 1}</h2>
              <UnreadBadge count={(i + revision) % 20} />
              {i % 3 === 0 ? (
                <FlamingCutFrame />
              ) : (
                <IllustratedFrame theme={i % 2 ? "celestial-energy" : "shadow-rise"} />
              )}
            </article>
          ))}
        </div>
      </Profiler>
    </>
  );
}

async function rtcBenchmark(quality: string) {
  const NativePeer = window.RTCPeerConnection;
  const originalCapture = navigator.mediaDevices.getUserMedia;
  const originalDisplay = navigator.mediaDevices.getDisplayMedia;
  const pcs: RTCPeerConnection[] = [];
  const contexts: AudioContext[] = [];
  window.RTCPeerConnection = class extends NativePeer {
    constructor() {
      super({ iceServers: [] });
      pcs.push(this);
    }
  };
  const capture = () => {
    const context = new AudioContext();
    contexts.push(context);
    const oscillator = context.createOscillator(),
      destination = context.createMediaStreamDestination();
    oscillator.frequency.value = 440;
    oscillator.connect(destination);
    oscillator.start();
    void context.resume();
    return destination.stream;
  };
  Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    configurable: true,
    value: async () => capture(),
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const paint = canvas.getContext("2d")!;
  let frame = 0;
  const drawing = setInterval(() => {
    paint.fillStyle = frame++ % 2 ? "#312e81" : "#0ea5e9";
    paint.fillRect(0, 0, 1280, 720);
  }, 1000 / 24);
  Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
    configurable: true,
    value: async () =>
      new MediaStream([...canvas.captureStream(24).getTracks(), ...capture().getTracks()]),
  });
  async function until(check: () => boolean) {
    const before = performance.now();
    while (!check()) {
      if (performance.now() - before > 15000) throw Error("RTC timeout");
      await pause(10);
    }
  }
  try {
    for (const mode of ["voice", "screen-audio"] as const) {
      document.documentElement.dataset["auditPhase"] = mode;
      for (let iteration = 0; iteration < 1; iteration++) {
        const peers = [createVoiceProvider(), createVoiceProvider()];
        const states = ["", ""],
          transitions: string[] = [];
        const captureBefore = performance.now();
        try {
          await peers[0]!.setNoiseSuppression("off");
          await peers[1]!.setNoiseSuppression("off");
          for (let i = 0; i < 2; i++)
            await peers[i]!.connect(`audit-${mode}-${iteration}`, i ? "bob" : "alice", {
              onStateChange: (state) => {
                states[i] = state;
                transitions.push(state);
              },
            });
          peers[0]!.syncPeers(["bob"]);
          peers[1]!.syncPeers(["alice"]);
          await until(() => states.every((s) => s === "connected"));
          const connectedMs = performance.now() - captureBefore;
          let screenMs: number | undefined;
          if (mode === "screen-audio") {
            const now = performance.now();
            await peers[0]!.startScreenShare();
            screenMs = performance.now() - now;
          }
          // Refinement benchmark uses the production schedule, without forced probes.
          if (sustained) await pause(mode === "voice" ? 45000 : 35000);
          else {
            await sampleMonitorNow();
            await pause(1700);
            await sampleMonitorNow();
          }
          await pause(50);
          const stats = [];
          for (const pc of pcs.filter((p) => p.connectionState === "connected")) {
            const values = [...(await pc.getStats()).values()];
            stats.push(
              values
                .filter(
                  (s) =>
                    s.type === "inbound-rtp" ||
                    s.type === "media-source" ||
                    (s.type === "candidate-pair" && s.nominated),
                )
                .map((s) => ({
                  type: s.type,
                  kind: s.kind,
                  packetsReceived: s.packetsReceived,
                  packetsLost: s.packetsLost,
                  jitter: s.jitter,
                  roundTripTime: s.currentRoundTripTime,
                  totalAudioEnergy: s.totalAudioEnergy,
                  audioLevel: s.audioLevel,
                  framesDecoded: s.framesDecoded,
                  jitterBufferDelay: s.jitterBufferDelay,
                  jitterBufferEmittedCount: s.jitterBufferEmittedCount,
                })),
            );
          }
          (report.rtc as unknown[]).push({
            quality,
            mode,
            iteration,
            connectedMs,
            screenMs,
            transitions,
            stats,
            captureStates: contexts.map((c) => c.state),
          });
        } finally {
          await Promise.all(peers.map((p) => p.disconnect()));
          await Promise.all(contexts.splice(0).map((c) => c.close()));
        }
      }
    }
  } finally {
    clearInterval(drawing);
    window.RTCPeerConnection = NativePeer;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: originalCapture,
    });
    Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
      configurable: true,
      value: originalDisplay,
    });
    await Promise.all(contexts.map((c) => c.close()));
    report["openPeersAfterCleanup-" + quality] = pcs.filter(
      (p) => p.connectionState !== "closed",
    ).length;
  }
}
createRoot(document.getElementById("root")!).render(<App />);
