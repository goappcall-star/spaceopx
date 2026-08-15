/**
 * Voice abstraction layer.
 *
 * The UI NEVER talks to WebRTC directly — it only talks to a `VoiceProvider`.
 * Today the shipped provider (`LocalMediaVoiceProvider`) captures the local
 * microphone and runs speaking detection through the Web Audio API, but it does
 * NOT transmit audio to other peers: that requires signaling + an SFU/TURN
 * infrastructure that is not part of this project yet.
 *
 * ==> WEBRTC INTEGRATION POINT <==
 * Implement `VoiceProvider` again as e.g. `SfuVoiceProvider` (LiveKit, Daily,
 * mediasoup, Janus...) and swap it in `createVoiceProvider()` below. Presence,
 * mute/deafen state, speaking rings, per-user volume and the UI keep working
 * unchanged, because they are all expressed through this interface.
 */

export interface VoiceProviderEvents {
  onSpeakingChange?: (speaking: boolean) => void;
  onStateChange?: (state: "connecting" | "connected" | "reconnecting" | "error") => void;
  onError?: (error: Error) => void;
}

export interface VoiceProvider {
  readonly transmitsAudio: boolean;
  connect(channelId: string, events: VoiceProviderEvents): Promise<void>;
  disconnect(): Promise<void>;
  setMuted(muted: boolean): void;
  setDeafened(deafened: boolean): void;
  /** Local-only playback gain for a remote participant (0–200%). */
  setUserVolume(userId: string, volume: number): void;
}

class LocalMediaVoiceProvider implements VoiceProvider {
  readonly transmitsAudio = false;

  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private raf: number | null = null;
  private muted = false;
  private speaking = false;
  private volumes = new Map<string, number>();

  async connect(_channelId: string, events: VoiceProviderEvents) {
    events.onStateChange?.("connecting");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      events.onStateChange?.("error");
      events.onError?.(error as Error);
      throw error;
    }

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.context = new AudioCtx();
    const source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128));
      const speaking = !this.muted && peak > 8;
      if (speaking !== this.speaking) {
        this.speaking = speaking;
        events.onSpeakingChange?.(speaking);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);

    events.onStateChange?.("connected");
  }

  async disconnect() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.analyser = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    await this.context?.close().catch(() => undefined);
    this.context = null;
    this.speaking = false;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }

  setDeafened(deafened: boolean) {
    // No remote audio yet — deafen also implies mute, mirroring Discord behaviour.
    if (deafened) this.setMuted(true);
  }

  setUserVolume(userId: string, volume: number) {
    // Stored locally; applied to remote audio elements once an SFU provider exists.
    this.volumes.set(userId, volume);
  }
}

export function createVoiceProvider(): VoiceProvider {
  // ==> Swap this line for an SFU-backed provider when voice infra is available.
  return new LocalMediaVoiceProvider();
}
