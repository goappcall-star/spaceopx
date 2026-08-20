/**
 * Voice / video abstraction layer.
 *
 * The UI never talks to WebRTC directly — it only talks to a `VoiceProvider`.
 * The shipped provider (`MeshVoiceProvider`) is a real WebRTC implementation:
 *
 * - signaling runs over a Supabase Realtime broadcast channel (`rtc:<channelId>`)
 * - one RTCPeerConnection per remote participant (full mesh, fine for small rooms)
 * - three transceivers are negotiated up-front in a fixed order so both sides
 *   agree on the meaning of each m-line without extra metadata:
 *     mid 0 -> microphone audio
 *     mid 1 -> camera video
 *     mid 2 -> screen share video
 *   Camera and screen share are therefore transmitted simultaneously.
 * - perfect negotiation (polite/impolite by user id comparison) avoids glare.
 *
 * Tracks are only ever created after an explicit user action, and every track is
 * stopped when the corresponding feature is turned off or the user disconnects.
 */

import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type MediaKind = "mic" | "camera" | "screen";

export interface RemoteMedia {
  audio: MediaStream | null;
  camera: MediaStream | null;
  screen: MediaStream | null;
}

export interface VoiceProviderEvents {
  onSpeakingChange?: (speaking: boolean) => void;
  onStateChange?: (state: "connecting" | "connected" | "reconnecting" | "error") => void;
  onError?: (error: Error) => void;
  /** Fired whenever the set of remote streams changes. */
  onRemoteMedia?: (media: Record<string, RemoteMedia>) => void;
  /** Fired when the user stops screen share from the browser UI. */
  onScreenShareEnded?: () => void;
  /** Fired when the local camera stream changes (on/off/device switch). */
  onLocalMedia?: (media: { camera: MediaStream | null; screen: MediaStream | null }) => void;
}

export interface DeviceIds {
  microphoneId?: string;
  cameraId?: string;
}

export interface VoiceProvider {
  readonly transmitsAudio: boolean;
  connect(channelId: string, userId: string, events: VoiceProviderEvents): Promise<void>;
  disconnect(): Promise<void>;
  /** Reconcile the mesh with the presence-derived participant list. */
  syncPeers(userIds: string[]): void;
  setMuted(muted: boolean): void;
  setDeafened(deafened: boolean): void;
  setUserVolume(userId: string, volume: number): void;
  enableCamera(deviceId?: string): Promise<void>;
  disableCamera(): void;
  startScreenShare(): Promise<void>;
  stopScreenShare(): void;
  setDevices(devices: DeviceIds): Promise<void>;
  /** Input gain in percent (0-200) applied to the outgoing microphone. */
  setInputGain(percent: number): void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 24, max: 30 },
};

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  transceivers: { mic: RTCRtpTransceiver; camera: RTCRtpTransceiver; screen: RTCRtpTransceiver };
}

class MeshVoiceProvider implements VoiceProvider {
  readonly transmitsAudio = true;

  private events: VoiceProviderEvents = {};
  private userId = "";
  private signaling: RealtimeChannel | null = null;
  private peers = new Map<string, Peer>();
  private remote: Record<string, RemoteMedia> = {};

  private micStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private processedStream: MediaStream | null = null;
  private inputGain = 1;
  private raf: number | null = null;

  private muted = false;
  private speaking = false;
  private devices: DeviceIds = {};
  private volumes = new Map<string, number>();
  private disposed = false;

  /* ------------------------------------------------------------- lifecycle */

  async connect(channelId: string, userId: string, events: VoiceProviderEvents) {
    this.events = events;
    this.userId = userId;
    this.disposed = false;
    events.onStateChange?.("connecting");

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          ...(this.devices.microphoneId ? { deviceId: { exact: this.devices.microphoneId } } : {}),
        },
      });
    } catch (error) {
      events.onStateChange?.("error");
      events.onError?.(error as Error);
      throw error;
    }

    this.applyMuteToTracks();
    this.startSpeakingDetection();

    await new Promise<void>((resolve, reject) => {
      const channel = supabase.channel(`rtc:${channelId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        void this.onSignal(payload as SignalPayload);
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.signaling = channel;
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error("signaling failed"));
        } else if (status === "CLOSED" && this.signaling) {
          this.events.onStateChange?.("reconnecting");
        }
      });
    });

    events.onStateChange?.("connected");
  }

  async disconnect() {
    this.disposed = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.analyser = null;
    this.gainNode = null;
    this.processedStream = null;
    await this.audioContext?.close().catch(() => undefined);
    this.audioContext = null;

    for (const [id, peer] of this.peers) {
      peer.pc.close();
      this.peers.delete(id);
    }
    this.remote = {};
    this.events.onRemoteMedia?.({});

    stopStream(this.micStream);
    stopStream(this.cameraStream);
    stopStream(this.screenStream);
    this.micStream = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.events.onLocalMedia?.({ camera: null, screen: null });

    if (this.signaling) {
      const channel = this.signaling;
      this.signaling = null;
      await supabase.removeChannel(channel);
    }
    this.speaking = false;
  }

  /* ------------------------------------------------------------------ mesh */

  syncPeers(userIds: string[]) {
    if (this.disposed || !this.signaling) return;
    const wanted = new Set(userIds.filter((id) => id !== this.userId));

    for (const [id, peer] of this.peers) {
      if (!wanted.has(id)) {
        peer.pc.close();
        this.peers.delete(id);
        delete this.remote[id];
        this.emitRemote();
      }
    }
    for (const id of wanted) {
      if (!this.peers.has(id)) this.createPeer(id);
    }
  }

  private createPeer(remoteId: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    // Deterministic m-line order on both ends: mic, camera, screen.
    const transceivers = {
      mic: pc.addTransceiver("audio", { direction: "sendrecv" }),
      camera: pc.addTransceiver("video", { direction: "sendrecv" }),
      screen: pc.addTransceiver("video", { direction: "sendrecv" }),
    };
    const peer: Peer = {
      pc,
      // The lexicographically smaller id is polite; ties are impossible.
      polite: this.userId < remoteId,
      makingOffer: false,
      ignoreOffer: false,
      transceivers,
    };
    this.peers.set(remoteId, peer);

    void transceivers.mic.sender.replaceTrack(this.outgoingAudioTrack());
    void transceivers.camera.sender.replaceTrack(this.cameraStream?.getVideoTracks()[0] ?? null);
    void transceivers.screen.sender.replaceTrack(this.screenStream?.getVideoTracks()[0] ?? null);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send(remoteId, { candidate: candidate.toJSON() });
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) this.send(remoteId, { description: pc.localDescription.toJSON() });
      } catch {
        /* negotiation retried on next change */
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.ontrack = ({ transceiver, track }) => {
      const kind = this.kindForTransceiver(peer, transceiver);
      if (!kind) return;
      const stream = new MediaStream([track]);
      this.updateRemote(remoteId, kind, stream);
      const clear = () => this.updateRemote(remoteId, kind, null);
      track.addEventListener("ended", clear);
      track.addEventListener("mute", clear);
      track.addEventListener("unmute", () => this.updateRemote(remoteId, kind, new MediaStream([track])));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        this.events.onStateChange?.("reconnecting");
        try {
          pc.restartIce();
        } catch {
          /* ignore */
        }
      } else if (pc.connectionState === "connected") {
        this.events.onStateChange?.("connected");
      }
    };

    return peer;
  }

  private kindForTransceiver(peer: Peer, transceiver: RTCRtpTransceiver): MediaKind | null {
    if (transceiver === peer.transceivers.mic) return "mic";
    if (transceiver === peer.transceivers.camera) return "camera";
    if (transceiver === peer.transceivers.screen) return "screen";
    // Fall back to mid ordering (remote-created transceivers).
    if (transceiver.mid === "0") return "mic";
    if (transceiver.mid === "1") return "camera";
    if (transceiver.mid === "2") return "screen";
    return null;
  }

  private updateRemote(userId: string, kind: MediaKind, stream: MediaStream | null) {
    const current = this.remote[userId] ?? { audio: null, camera: null, screen: null };
    const key = kind === "mic" ? "audio" : kind;
    this.remote = { ...this.remote, [userId]: { ...current, [key]: stream } };
    this.emitRemote();
  }

  private emitRemote() {
    this.events.onRemoteMedia?.({ ...this.remote });
  }

  /* ------------------------------------------------------------- signaling */

  private send(to: string, data: Omit<SignalPayload, "from" | "to">) {
    void this.signaling?.send({
      type: "broadcast",
      event: "signal",
      payload: { from: this.userId, to, ...data },
    });
  }

  private async onSignal(payload: SignalPayload) {
    if (this.disposed || payload.to !== this.userId || payload.from === this.userId) return;
    const peer = this.peers.get(payload.from) ?? this.createPeer(payload.from);
    const { pc } = peer;

    try {
      if (payload.description) {
        const description = payload.description;
        const offerCollision =
          description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) return;

        await pc.setRemoteDescription(description);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          if (pc.localDescription)
            this.send(payload.from, { description: pc.localDescription.toJSON() });
        }
      } else if (payload.candidate) {
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          if (!peer.ignoreOffer) throw new Error("ice");
        }
      }
    } catch {
      /* transient signaling error; negotiation will retry */
    }
  }

  /* -------------------------------------------------------------- controls */

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMuteToTracks();
  }

  /** Processed (gain-adjusted) mic track when the audio graph is up, raw track otherwise. */
  private outgoingAudioTrack(): MediaStreamTrack | null {
    return (
      this.processedStream?.getAudioTracks()[0] ?? this.micStream?.getAudioTracks()[0] ?? null
    );
  }

  setInputGain(percent: number) {
    this.inputGain = Math.max(0, Math.min(200, percent)) / 100;
    if (this.gainNode) this.gainNode.gain.value = this.inputGain;
  }

  private applyMuteToTracks() {
    this.micStream?.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
  }

  setDeafened(deafened: boolean) {
    if (deafened) this.setMuted(true);
  }

  setUserVolume(userId: string, volume: number) {
    this.volumes.set(userId, volume);
  }

  async enableCamera(deviceId?: string) {
    const id = deviceId ?? this.devices.cameraId;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { ...CAMERA_CONSTRAINTS, ...(id ? { deviceId: { exact: id } } : {}) },
    });
    stopStream(this.cameraStream);
    this.cameraStream = stream;
    const track = stream.getVideoTracks()[0] ?? null;
    track?.addEventListener("ended", () => this.disableCamera());
    for (const peer of this.peers.values()) void peer.transceivers.camera.sender.replaceTrack(track);
    this.events.onLocalMedia?.({ camera: stream, screen: this.screenStream });
  }

  disableCamera() {
    if (!this.cameraStream) return;
    stopStream(this.cameraStream);
    this.cameraStream = null;
    for (const peer of this.peers.values()) void peer.transceivers.camera.sender.replaceTrack(null);
    this.events.onLocalMedia?.({ camera: null, screen: this.screenStream });
  }

  async startScreenShare() {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 } },
      audio: false,
    });
    stopStream(this.screenStream);
    this.screenStream = stream;
    const track = stream.getVideoTracks()[0] ?? null;
    track?.addEventListener("ended", () => {
      this.stopScreenShare();
      this.events.onScreenShareEnded?.();
    });
    for (const peer of this.peers.values()) void peer.transceivers.screen.sender.replaceTrack(track);
    this.events.onLocalMedia?.({ camera: this.cameraStream, screen: stream });
  }

  stopScreenShare() {
    if (!this.screenStream) return;
    stopStream(this.screenStream);
    this.screenStream = null;
    for (const peer of this.peers.values()) void peer.transceivers.screen.sender.replaceTrack(null);
    this.events.onLocalMedia?.({ camera: this.cameraStream, screen: null });
  }

  async setDevices(devices: DeviceIds) {
    const previous = this.devices;
    this.devices = { ...previous, ...devices };

    if (devices.microphoneId && devices.microphoneId !== previous.microphoneId && this.micStream) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: { exact: devices.microphoneId },
        },
      });
      stopStream(this.micStream);
      this.micStream = stream;
      this.applyMuteToTracks();
      this.startSpeakingDetection();
      const track = this.outgoingAudioTrack();
      for (const peer of this.peers.values()) void peer.transceivers.mic.sender.replaceTrack(track);
    }

    if (devices.cameraId && devices.cameraId !== previous.cameraId && this.cameraStream) {
      await this.enableCamera(devices.cameraId);
    }
  }

  /* ----------------------------------------------------- speaking detection */

  private startSpeakingDetection() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    void this.audioContext?.close().catch(() => undefined);

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx || !this.micStream) return;

    this.audioContext = new AudioCtx();
    const source = this.audioContext.createMediaStreamSource(this.micStream);
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.inputGain;
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.gainNode);
    this.gainNode.connect(this.analyser);

    // Peers receive the gain-adjusted signal, never the raw device track.
    const destination = this.audioContext.createMediaStreamDestination();
    this.gainNode.connect(destination);
    this.processedStream = destination.stream;

    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128));
      const speaking = !this.muted && peak > 8;
      if (speaking !== this.speaking) {
        this.speaking = speaking;
        this.events.onSpeakingChange?.(speaking);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }
}

interface SignalPayload {
  from: string;
  to: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function createVoiceProvider(): VoiceProvider {
  return new MeshVoiceProvider();
}

/* ------------------------------------------------------------ device utils */

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface MediaDeviceList {
  microphones: MediaDeviceOption[];
  cameras: MediaDeviceOption[];
  outputs: MediaDeviceOption[];
}

export async function listMediaDevices(): Promise<MediaDeviceList> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return { microphones: [], cameras: [], outputs: [] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const map = (kind: MediaDeviceKind, fallback: string) =>
    devices
      .filter((d) => d.kind === kind && d.deviceId)
      .map((d, index) => ({ deviceId: d.deviceId, label: d.label || `${fallback} ${index + 1}` }));
  return {
    microphones: map("audioinput", "Microfone"),
    cameras: map("videoinput", "Câmera"),
    outputs: map("audiooutput", "Saída"),
  };
}

export function supportsScreenShare(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

export function supportsCamera(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}
