import { RNNOISE_WORKLET_URL } from "@/generated/audio-worklet";

export type NoiseSuppressionMode = "off" | "standard" | "advanced";
export interface NoiseProcessingStatus {
  requested: NoiseSuppressionMode;
  effective: NoiseSuppressionMode;
  loading: boolean;
  fallback?: boolean;
}

export const NOISE_MODE_LABELS: Record<NoiseSuppressionMode, string> = {
  off: "Desativada",
  standard: "Padrão",
  advanced: "Avançada",
};

const workletModules = new WeakMap<AudioContext, Promise<void>>();
const disposedNodes = new WeakMap<AudioWorkletNode, Promise<void>>();

/** Disposal is acknowledged before context.close(), freeing RNNoise's WASM state. */
function disposeNode(node: AudioWorkletNode): Promise<void> {
  const existing = disposedNodes.get(node);
  if (existing) return existing;
  node.disconnect();
  const disposing = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 150);
    node.port.onmessage = ({ data }) => {
      if (data?.type === "disposed") {
        clearTimeout(timer);
        resolve();
      }
    };
    node.port.postMessage({ type: "dispose" });
  }).then(() => {
    node.port.onmessage = null;
    node.port.close();
  });
  disposedNodes.set(node, disposing);
  return disposing;
}

async function createDenoiser(context: AudioContext, signal: AbortSignal, onError: () => void) {
  if (
    !context.audioWorklet ||
    typeof AudioWorkletNode === "undefined" ||
    context.sampleRate !== 48000
  )
    throw new Error("AudioWorklet unavailable");
  let node: AudioWorkletNode | null = null;
  let timer: ReturnType<typeof setTimeout>;
  let rejectReady: (reason: Error) => void;
  const stopped = new Promise<never>((_, reject) => {
    rejectReady = reject;
    timer = setTimeout(() => reject(new Error("RNNoise load timeout")), 8000);
  });
  const abort = () => rejectReady(new DOMException("Processing cancelled", "AbortError"));
  signal.addEventListener("abort", abort, { once: true });
  try {
    if (signal.aborted) throw new DOMException("Processing cancelled", "AbortError");
    let module = workletModules.get(context);
    if (!module) {
      module = context.audioWorklet.addModule(RNNOISE_WORKLET_URL);
      workletModules.set(context, module);
      void module.catch(() => workletModules.delete(context));
    }
    await Promise.race([module, stopped]);
    if (signal.aborted || context.state === "closed")
      throw new DOMException("Processing cancelled", "AbortError");
    node = new AudioWorkletNode(context, "lobbyx-rnnoise-v1", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: "explicit",
      channelInterpretation: "speakers",
    });
    const ready = new Promise<void>((resolve, reject) => {
      node!.port.onmessage = ({ data }) => {
        if (data?.type === "ready") resolve();
        else if (data?.type === "error") reject(new Error("RNNoise initialization failed"));
      };
      node!.onprocessorerror = () => reject(new Error("RNNoise processor failed"));
    });
    await Promise.race([ready, stopped]);
    node.port.onmessage = ({ data }) => {
      if (data?.type === "error") onError();
    };
    node.onprocessorerror = onError;
    return node;
  } catch (error) {
    if (node) await disposeNode(node);
    throw error;
  } finally {
    clearTimeout(timer!);
    signal.removeEventListener("abort", abort);
  }
}

/** One stable destination track for the whole call, including mode/device changes. */
export class MicrophoneAudioPipeline {
  readonly context: AudioContext;
  readonly gain: GainNode;
  readonly analyser: AnalyserNode;
  readonly stream: MediaStream;
  private source: MediaStreamAudioSourceNode | null = null;
  private input: MediaStream | null = null;
  private denoiser: AudioWorkletNode | null = null;
  private pending: AbortController | null = null;
  private generation = 0;
  private closed = false;
  private effective: NoiseSuppressionMode = "standard";
  private requested: NoiseSuppressionMode = "standard";
  private closingNodes = new Set<Promise<void>>();
  private pendingModes = new Set<Promise<void>>();
  private microphoneChanged = true;
  private constraintsQueue = Promise.resolve();

  constructor(private readonly report: (status: NoiseProcessingStatus) => void) {
    try {
      this.context = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
    } catch {
      this.context = new AudioContext({ latencyHint: "interactive" });
    }
    this.gain = this.context.createGain();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    const destination = this.context.createMediaStreamDestination();
    this.stream = destination.stream;
    this.gain.connect(this.analyser);
    this.gain.connect(destination);
    void this.context.resume().catch(() => undefined);
  }

  attachMicrophone(stream: MediaStream) {
    if (this.closed) throw new DOMException("Pipeline closed", "AbortError");
    this.source?.disconnect();
    this.input = stream;
    this.microphoneChanged = true;
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.denoiser ?? this.gain);
  }

  setGain(percent: number) {
    this.gain.gain.value = Math.max(0, Math.min(200, percent)) / 100;
  }
  setMuted(muted: boolean) {
    this.input?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    // Also suppress the delayed RNNoise tail immediately on mute/PTT release.
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  setMode(mode: NoiseSuppressionMode): Promise<void> {
    if (this.closed) return Promise.resolve();
    // Re-renders of call state must not restart an active/loading model.
    if (!this.microphoneChanged && mode === this.requested) return Promise.resolve();
    this.microphoneChanged = false;
    this.requested = mode;
    const operation = this.changeMode(mode);
    this.pendingModes.add(operation);
    void operation.finally(() => this.pendingModes.delete(operation)).catch(() => undefined);
    return operation;
  }

  private nativeSuppression(enabled: boolean) {
    const generation = this.generation;
    const operation = this.constraintsQueue.then(async () => {
      if (this.closed || generation !== this.generation) return;
      const track = this.input?.getAudioTracks()[0];
      if (track && track.readyState !== "ended")
        await track.applyConstraints({ ...track.getConstraints(), noiseSuppression: enabled });
    });
    this.constraintsQueue = operation.catch(() => undefined);
    return operation;
  }

  private retireNode() {
    if (!this.denoiser) return;
    const node = this.denoiser;
    this.denoiser = null;
    node.onprocessorerror = null;
    const closing = disposeNode(node);
    this.closingNodes.add(closing);
    void closing.finally(() => this.closingNodes.delete(closing));
  }

  private async changeMode(mode: NoiseSuppressionMode) {
    const generation = ++this.generation;
    const isCurrent = () => !this.closed && this.generation === generation;
    this.pending?.abort();
    this.pending = null;
    this.source?.disconnect();
    this.retireNode();
    this.source?.connect(this.gain);
    this.effective = mode === "off" ? "off" : "standard";
    await this.nativeSuppression(mode !== "off").catch(() => undefined);
    if (!isCurrent()) return;
    this.report({ requested: mode, effective: this.effective, loading: mode === "advanced" });
    if (mode !== "advanced") return;
    const abort = new AbortController();
    this.pending = abort;
    let candidate: AudioWorkletNode | null = null;
    try {
      candidate = await createDenoiser(this.context, abort.signal, () => {
        if (!isCurrent()) return;
        this.generation++;
        this.pending?.abort();
        this.pending = null;
        this.source?.disconnect();
        this.retireNode();
        this.source?.connect(this.gain);
        this.effective = "standard";
        void this.nativeSuppression(true).catch(() => undefined);
        this.report({ requested: mode, effective: "standard", loading: false, fallback: true });
      });
      if (!isCurrent()) {
        await disposeNode(candidate);
        return;
      }
      await this.nativeSuppression(false);
      if (!isCurrent()) {
        await disposeNode(candidate);
        return;
      }
      this.denoiser = candidate;
      candidate.connect(this.gain);
      this.source?.disconnect();
      this.source?.connect(candidate);
      this.effective = "advanced";
      this.report({ requested: mode, effective: "advanced", loading: false });
    } catch {
      if (candidate) await disposeNode(candidate);
      if (!isCurrent()) return;
      await this.nativeSuppression(true).catch(() => undefined);
      this.effective = "standard";
      this.report({ requested: mode, effective: "standard", loading: false, fallback: true });
    } finally {
      if (this.pending === abort) this.pending = null;
    }
  }

  async dispose() {
    if (this.closed) return;
    this.closed = true;
    this.generation++;
    this.pending?.abort();
    this.pending = null;
    this.source?.disconnect();
    this.source = null;
    this.retireNode();
    this.gain.disconnect();
    this.analyser.disconnect();
    this.stream.getTracks().forEach((track) => track.stop());
    await Promise.allSettled([...this.pendingModes, ...this.closingNodes]);
    await this.context.close().catch(() => undefined);
    this.input = null;
  }
}
