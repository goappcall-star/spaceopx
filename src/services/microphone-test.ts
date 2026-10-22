import { clampGlobalVolume } from "@/lib/audio-volume";
import {
  borrowMicrophoneForTest,
  MicrophoneAudioPipeline,
  type NoiseSuppressionMode,
  type NoiseProcessingStatus,
} from "./audio-processing";

export interface MicrophoneTestOptions {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  inputVolume: number;
  outputVolume: number;
  noiseSuppression: NoiseSuppressionMode;
}

/** Owns only test resources. Borrowing a live call never changes capture, gain, mute or PTT. */
export class MicrophoneTestSession {
  private stopped = false;
  private owned: MediaStream | null = null;
  private pipeline: MicrophoneAudioPipeline | null = null;
  private release: (() => void) | null = null;
  private element: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  borrowed = false;
  private volumes: { input: number; output: number } | null = null;

  constructor(
    private readonly onEnded: () => void,
    private readonly report: (status: NoiseProcessingStatus | null) => void = () => {},
  ) {}

  async start(options: MicrophoneTestOptions, onLevel: (level: number) => void) {
    try {
      await this.startMonitoring(options, onLevel);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  private async startMonitoring(options: MicrophoneTestOptions, onLevel: (level: number) => void) {
    if (this.stopped) return;
    const invalidated = () => {
      this.stop();
      this.onEnded();
    };
    let tap = borrowMicrophoneForTest(invalidated);
    if (!tap) {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Error(
          "Teste indisponível: o navegador precisa oferecer acesso ao microfone em um contexto seguro (HTTPS ou localhost).",
        );
      if (typeof AudioContext === "undefined")
        throw Error("Este navegador não oferece Web Audio para o teste de microfone.");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: options.noiseSuppression !== "off",
          autoGainControl: true,
          ...(options.inputDeviceId ? { deviceId: { exact: options.inputDeviceId } } : {}),
        },
      });
      if (this.stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      // A call may have acquired capture while the permission dialog was open.
      tap = borrowMicrophoneForTest(invalidated);
      if (tap) stream.getTracks().forEach((track) => track.stop());
      else {
        this.owned = stream;
        stream
          .getAudioTracks()
          .forEach((track) => track.addEventListener("ended", invalidated, { once: true }));
        this.pipeline = new MicrophoneAudioPipeline(this.report, "test");
        this.pipeline.attachMicrophone(stream);
        this.pipeline.setGain(this.volumes?.input ?? options.inputVolume);
        await this.pipeline.setMode(options.noiseSuppression);
        if (!this.stopped) await this.pipeline.context.resume();
      }
    }
    if (this.stopped) {
      tap?.release();
      return;
    }
    this.borrowed = !!tap;
    this.release = tap?.release ?? null;
    const source = tap ?? this.pipeline!;
    const element = document.createElement("audio");
    this.element = element;
    element.srcObject = source.stream;
    element.volume = clampGlobalVolume(this.volumes?.output ?? options.outputVolume) / 100;
    if (options.outputDeviceId) {
      if (!("setSinkId" in element))
        throw Error(
          "Este navegador não permite escolher a saída do retorno. Use a saída padrão do sistema.",
        );
      await element.setSinkId(options.outputDeviceId);
    }
    if (this.stopped) return;
    await element.play();
    if (this.stopped) {
      element.pause();
      element.srcObject = null;
      return;
    }
    const buffer = new Uint8Array(source.analyser.frequencyBinCount);
    this.timer = setInterval(() => {
      source.analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (const value of buffer) sum += ((value - 128) / 128) ** 2;
      onLevel(Math.min(1, Math.sqrt(sum / buffer.length) * 4));
    }, 80);
  }

  setVolumes(input: number, output: number) {
    this.volumes = { input: clampGlobalVolume(input), output: clampGlobalVolume(output) };
    this.pipeline?.setGain(this.volumes.input);
    if (this.element) this.element.volume = clampGlobalVolume(output) / 100;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.element?.pause();
    if (this.element) this.element.srcObject = null;
    this.release?.();
    this.owned?.getTracks().forEach((track) => track.stop());
    void this.pipeline?.dispose();
    this.report(null);
    this.element = null;
    this.release = null;
    this.owned = null;
  }
}

/** Short output check with cancellation even while sink selection/play is pending. */
export class SpeakerTestSession {
  private context: AudioContext | null = null;
  private element: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  async start(device: string | null, volume: number) {
    try {
      await this.startTone(device, volume);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  setVolume(volume: number) {
    if (this.element) this.element.volume = clampGlobalVolume(volume) / 100;
  }

  private async startTone(device: string | null, volume: number) {
    if (this.stopped) return;
    const context = new AudioContext();
    this.context = context;
    const destination = context.createMediaStreamDestination();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 440;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(destination);
    const element = document.createElement("audio");
    this.element = element;
    element.srcObject = destination.stream;
    element.volume = clampGlobalVolume(volume) / 100;
    if (device) {
      if (!("setSinkId" in element)) throw Error("Seleção de saída indisponível neste navegador.");
      await element.setSinkId(device);
    }
    if (this.stopped) return;
    await context.resume();
    if (this.stopped) return;
    oscillator.start();
    await element.play();
    if (this.stopped) {
      element.pause();
      return;
    }
    this.timer = setTimeout(() => this.stop(), 900);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.element?.pause();
    if (this.element) {
      const stream = this.element.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      this.element.srcObject = null;
    }
    void this.context?.close().catch(() => undefined);
  }
}
