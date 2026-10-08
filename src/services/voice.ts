/**
 * Voice / video abstraction layer.
 *
 * The UI never talks to WebRTC directly — it only talks to a `VoiceProvider`.
 * The shipped provider (`MeshVoiceProvider`) is a real WebRTC implementation:
 *
 * - signaling runs over a Supabase Realtime broadcast channel (`rtc:<channelId>`)
 * - every client announces itself with a `hello` when it subscribes, so peers are
 *   only created once both ends can actually receive signaling (broadcast has no
 *   history — an offer sent too early is simply lost)
 * - one RTCPeerConnection per remote participant (full mesh, fine for small rooms)
 * - EXACTLY ONE side (the lexicographically greater user id) creates the four
 *   m-lines, in a fixed order, so both ends agree on their meaning:
 *     mid 0 -> microphone audio
 *     mid 1 -> camera video
 *     mid 2 -> screen share video
 *     mid 3 -> screen share audio (independent of microphone)
 *   The answering side binds those mids to its own slots and sends on them.
 *   Camera and screen share are therefore transmitted simultaneously and are
 *   never confused with one another.
 * - perfect negotiation (polite/impolite by user id comparison) handles glare.
 * - ICE candidates arriving before the remote description are buffered, and a
 *   failing link is restarted per peer, never by dropping the whole room.
 *
 * Tracks are only ever created after an explicit user action, and every track is
 * stopped when the corresponding feature is turned off or the user disconnects.
 */

import { supabase } from "@/integrations/supabase/client";
import { shouldExposeRemoteTrack } from "./remote-track";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  MicrophoneAudioPipeline,
  type NoiseProcessingStatus,
  type NoiseSuppressionMode,
} from "./audio-processing";

export type MediaKind = "mic" | "camera" | "screen" | "screenAudio";

export interface RemoteMedia {
  audio: MediaStream | null;
  camera: MediaStream | null;
  screen: MediaStream | null;
  screenAudio: MediaStream | null;
}

export interface VoiceProviderEvents {
  onRemoteSpeakingChange?: (speaking: Record<string, boolean>) => void;
  onNoiseProcessingChange?: (status: NoiseProcessingStatus) => void;
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
  microphoneId?: string | null;
  cameraId?: string;
}

export interface VoiceProvider {
  readonly transmitsAudio: boolean;
  readonly screenShareHasAudio: boolean;
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
  setNoiseSuppression(mode: NoiseSuppressionMode): Promise<void>;
}

/**
 * STUN is always on. TURN is optional and configured through public env vars
 * (never a committed secret) — needed on networks where direct P2P is blocked.
 */
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];
  const env = import.meta.env as Record<string, string | undefined>;
  const turnUrl = env["VITE_TURN_URL"];
  if (turnUrl) {
    servers.push({
      urls: turnUrl.split(",").map((url) => url.trim()),
      ...(env["VITE_TURN_USERNAME"] ? { username: env["VITE_TURN_USERNAME"] } : {}),
      ...(env["VITE_TURN_CREDENTIAL"] ? { credential: env["VITE_TURN_CREDENTIAL"] } : {}),
    });
  }
  return servers;
}

const ICE_SERVERS: RTCIceServer[] = buildIceServers();

const CAMERA_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 24, max: 30 },
};

interface Peer {
  id: string;
  /** Distinguishes a rapid re-entry by the same user from the closed session. */
  remoteSessionId: string | null;
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  /** Null on the answering side until the offer's m-lines are bound by mid. */
  transceivers: {
    mic: RTCRtpTransceiver | null;
    camera: RTCRtpTransceiver | null;
    screen: RTCRtpTransceiver | null;
    screenAudio: RTCRtpTransceiver | null;
  };
  /** Stable per-kind remote streams — never recreated, so <audio>/<video> keep playing. */
  streams: { mic: MediaStream; camera: MediaStream; screen: MediaStream; screenAudio: MediaStream };
  /** Candidates that arrived before the remote description was applied. */
  pendingCandidates: RTCIceCandidateInit[];
  /** Process whole SDP exchanges in order, not just individual browser operations. */
  signalQueue: Promise<void>;
  state: RTCPeerConnectionState;
  restartTimer: ReturnType<typeof setTimeout> | null;
  absenceTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
}

class MeshVoiceProvider implements VoiceProvider {
  readonly transmitsAudio = true;
  get screenShareHasAudio() {
    return !!this.screenStream?.getAudioTracks().some((track) => track.readyState === "live");
  }

  private events: VoiceProviderEvents = {};
  private userId = "";
  private readonly sessionId = crypto.randomUUID();
  private signaling: RealtimeChannel | null = null;
  private pendingSignaling: RealtimeChannel | null = null;
  private peers = new Map<string, Peer>();
  private remote: Record<string, RemoteMedia> = {};
  private remoteScreens = new Map<string, { active: boolean; hasAudio: boolean }>();

  private micStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;

  private audioPipeline: MicrophoneAudioPipeline | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private processedStream: MediaStream | null = null;
  private inputGain = 1;
  private noiseSuppression: NoiseSuppressionMode = "standard";
  private raf: number | null = null;

  private muted = false;
  private speaking = false;
  private remoteSpeaking: Record<string, boolean> = {};
  private remoteDetectors = new Map<
    string,
    {
      track: MediaStreamTrack;
      source: MediaStreamAudioSourceNode;
      analyser: AnalyserNode;
      buffer: Uint8Array<ArrayBuffer>;
      lastActivity: number;
    }
  >();
  private detectionSink: GainNode | null = null;
  private devices: DeviceIds = {};
  private volumes = new Map<string, number>();
  private disposed = false;
  private disconnectPromise: Promise<void> | null = null;
  private cameraGeneration = 0;
  private screenGeneration = 0;
  private microphoneGeneration = 0;

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
          noiseSuppression: this.noiseSuppression !== "off",
          autoGainControl: true,
          ...(this.devices.microphoneId ? { deviceId: { exact: this.devices.microphoneId } } : {}),
        },
      });
      if (this.disposed) {
        stopStream(this.micStream);
        this.micStream = null;
        throw new DOMException("Voice session ended", "AbortError");
      }
    } catch (error) {
      if (!this.disposed) {
        events.onStateChange?.("error");
        events.onError?.(error as Error);
      }
      throw error;
    }

    this.applyMuteToTracks();
    await this.startSpeakingDetection();

    if (this.disposed) throw new DOMException("Voice session ended", "AbortError");

    await new Promise<void>((resolve, reject) => {
      const channel = supabase.channel(`rtc:${channelId}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      this.pendingSignaling = channel;
      let settled = false;
      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        void this.onSignal(payload as SignalPayload);
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          if (this.disposed) {
            if (!settled) {
              settled = true;
              reject(new DOMException("Voice session ended", "AbortError"));
            }
            void supabase.removeChannel(channel);
            return;
          }
          this.pendingSignaling = null;
          this.signaling = channel;
          // Announce ourselves: peers already in the room answer with their own
          // hello, which is what makes negotiation start only once BOTH sides
          // are actually subscribed (broadcast has no message history).
          this.broadcast({ hello: true });
          this.emitAggregateState();
          if (!settled) {
            settled = true;
            resolve();
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (!settled) {
            settled = true;
            reject(new Error("signaling failed"));
          }
        } else if (status === "CLOSED") {
          if (!settled) {
            settled = true;
            reject(new DOMException("Voice signaling closed", "AbortError"));
          } else if (!this.disposed && this.signaling === channel) {
            // Signaling carries negotiation, not the established media. A
            // socket interruption must not report a healthy P2P call as lost.
            this.emitAggregateState();
          }
        }
      });
    });

    // Real state comes from the peer connections, not from the signaling socket.
    this.emitAggregateState();
  }

  async disconnect() {
    if (this.disconnectPromise) return this.disconnectPromise;
    this.disconnectPromise = this.performDisconnect();
    return this.disconnectPromise;
  }

  private async performDisconnect() {
    const departure = this.signaling?.send({
      type: "broadcast",
      event: "signal",
      payload: { from: this.userId, from_session: this.sessionId, to: "*", bye: true },
    });
    this.disposed = true;
    this.cameraGeneration += 1;
    this.screenGeneration += 1;
    this.microphoneGeneration += 1;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.analyser = null;
    this.gainNode = null;
    stopStream(this.micStream);
    for (const detector of this.remoteDetectors.values()) {
      detector.source.disconnect();
      detector.analyser.disconnect();
    }
    this.remoteDetectors.clear();
    this.detectionSink?.disconnect();
    this.detectionSink = null;
    this.remoteSpeaking = {};
    this.events.onRemoteSpeakingChange?.({});
    await this.audioPipeline?.dispose();
    this.audioPipeline = null;
    this.processedStream = null;

    for (const [id, peer] of this.peers) {
      this.closePeer(id, peer);
    }
    this.remote = {};
    this.remoteScreens.clear();
    this.events.onRemoteMedia?.({});

    stopStream(this.micStream);
    stopStream(this.cameraStream);
    stopStream(this.screenStream);
    this.micStream = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.events.onLocalMedia?.({ camera: null, screen: null });

    const channel = this.signaling ?? this.pendingSignaling;
    this.signaling = null;
    this.pendingSignaling = null;
    if (channel) {
      await departure?.catch(() => undefined);
      await supabase.removeChannel(channel);
    }
    this.speaking = false;
  }

  /* ------------------------------------------------------------------ mesh */

  syncPeers(userIds: string[]) {
    if (this.disposed || !this.signaling) return;
    const wanted = new Set(userIds.filter((id) => id !== this.userId));

    for (const [id, peer] of this.peers) {
      if (wanted.has(id)) {
        if (peer.absenceTimer) clearTimeout(peer.absenceTimer);
        peer.absenceTimer = null;
      } else if (!peer.absenceTimer) {
        // A Presence resubscription can briefly return an empty room, even
        // while media is flowing. Require continuous absence before teardown.
        // Explicit bye/session replacement still closes the peer immediately.
        peer.absenceTimer = setTimeout(() => {
          peer.absenceTimer = null;
          if (this.disposed || this.peers.get(id) !== peer) return;
          this.closePeer(id, peer);
          this.emitAggregateState();
        }, 10_000);
      }
    }
    for (const id of wanted) {
      if (!this.peers.has(id)) this.createPeer(id);
    }
    this.emitAggregateState();
  }

  /** Tear a single peer down without touching any of the others. */
  private closePeer(id: string, peer: Peer) {
    if (peer.restartTimer) clearTimeout(peer.restartTimer);
    if (peer.absenceTimer) clearTimeout(peer.absenceTimer);
    peer.pc.onicecandidate = null;
    peer.pc.onnegotiationneeded = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    peer.pc.oniceconnectionstatechange = null;
    try {
      peer.pc.close();
    } catch {
      /* already closed */
    }
    this.peers.delete(id);
    this.remoteScreens.delete(id);
    delete this.remote[id];
    this.emitRemote();
  }

  private createPeer(remoteId: string): Peer {
    const existing = this.peers.get(remoteId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    // Exactly ONE side creates the m-lines. If both did, the session would end
    // up with six m-lines and each side would receive tracks on transceivers it
    // cannot map back to mic/camera/screen — that is what silently dropped the
    // incoming audio in one direction.
    const initiator = this.userId > remoteId;
    const transceivers: Peer["transceivers"] = initiator
      ? {
          // Deterministic m-line order on both ends: mic, camera, screen.
          mic: pc.addTransceiver("audio", { direction: "sendrecv" }),
          camera: pc.addTransceiver("video", { direction: "sendrecv" }),
          screen: pc.addTransceiver("video", { direction: "sendrecv" }),
          screenAudio: pc.addTransceiver("audio", { direction: "sendrecv" }),
        }
      : { mic: null, camera: null, screen: null, screenAudio: null };

    const peer: Peer = {
      id: remoteId,
      remoteSessionId: null,
      pc,
      // The lexicographically smaller id is polite; ties are impossible.
      polite: this.userId < remoteId,
      makingOffer: false,
      ignoreOffer: false,
      transceivers,
      streams: {
        mic: new MediaStream(),
        camera: new MediaStream(),
        screen: new MediaStream(),
        screenAudio: new MediaStream(),
      },
      pendingCandidates: [],
      signalQueue: Promise.resolve(),
      state: "new",
      restartTimer: null,
      absenceTimer: null,
      createdAt: Date.now(),
    };
    this.peers.set(remoteId, peer);

    if (initiator) {
      void transceivers.mic?.sender.replaceTrack(this.localTrack("mic"));
      void transceivers.camera?.sender.replaceTrack(this.localTrack("camera"));
      void transceivers.screen?.sender.replaceTrack(this.localTrack("screen"));
      void transceivers.screenAudio?.sender.replaceTrack(this.localTrack("screenAudio"));
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.send(remoteId, { candidate: candidate.toJSON() });
    };

    pc.onnegotiationneeded = async () => {
      if (this.disposed || this.peers.get(remoteId) !== peer || pc.signalingState !== "stable")
        return;
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
      const stream = peer.streams[kind];
      for (const other of stream.getTracks()) if (other !== track) stream.removeTrack(other);
      if (!stream.getTracks().includes(track)) stream.addTrack(track);
      this.updateRemote(remoteId, kind, shouldExposeRemoteTrack(kind, track) ? stream : null);

      track.addEventListener("ended", () => {
        stream.removeTrack(track);
        this.updateRemote(remoteId, kind, null);
      });
      // Audio is NEVER dropped on `mute`: remote audio tracks start muted and go
      // briefly muted on packet loss — clearing it there kills incoming voice.
      if (kind !== "mic") {
        track.addEventListener("mute", () => this.updateRemote(remoteId, kind, null));
        track.addEventListener("unmute", () => {
          this.updateRemote(remoteId, kind, shouldExposeRemoteTrack(kind, track) ? stream : null);
        });
      }
    };

    pc.onconnectionstatechange = () => {
      peer.state = pc.connectionState;
      if (pc.connectionState === "failed") this.scheduleIceRestart(peer, 0);
      this.emitAggregateState();
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected") this.scheduleIceRestart(peer, 2500);
      else if (pc.iceConnectionState === "connected" && peer.restartTimer) {
        clearTimeout(peer.restartTimer);
        peer.restartTimer = null;
      }
    };

    return peer;
  }

  /** Per-peer recovery: one bad link never disturbs the other participants. */
  private scheduleIceRestart(peer: Peer, delay: number) {
    if (peer.restartTimer || this.disposed) return;
    // Only the impolite side restarts, so both ends never restart at once.
    if (peer.polite) return;
    peer.restartTimer = setTimeout(() => {
      peer.restartTimer = null;
      const state = peer.pc.iceConnectionState;
      if (state !== "disconnected" && state !== "failed") return;
      try {
        peer.pc.restartIce();
      } catch {
        /* connection already closed */
      }
    }, delay);
  }

  private emitAggregateState() {
    if (this.disposed) return;
    const states = [...this.peers.values()].map((p) => p.state);
    if (states.length === 0 || states.some((s) => s === "connected"))
      this.events.onStateChange?.("connected");
    else if (states.some((s) => s === "new" || s === "connecting"))
      this.events.onStateChange?.("connecting");
    else this.events.onStateChange?.("reconnecting");
  }

  private kindForTransceiver(peer: Peer, transceiver: RTCRtpTransceiver): MediaKind | null {
    if (peer.transceivers.mic && transceiver === peer.transceivers.mic) return "mic";
    if (peer.transceivers.camera && transceiver === peer.transceivers.camera) return "camera";
    if (peer.transceivers.screen && transceiver === peer.transceivers.screen) return "screen";
    // Fall back to mid ordering (remote-created transceivers).
    if (transceiver.mid === "0") return "mic";
    if (transceiver.mid === "1") return "camera";
    if (peer.transceivers.screenAudio && transceiver === peer.transceivers.screenAudio)
      return "screenAudio";
    if (transceiver.mid === "2") return "screen";
    if (transceiver.mid === "3") return "screenAudio";
    return null;
  }

  /** Local track currently feeding a given media slot. */
  private localTrack(kind: MediaKind): MediaStreamTrack | null {
    if (kind === "mic") return this.outgoingAudioTrack();
    if (kind === "camera") return this.cameraStream?.getVideoTracks()[0] ?? null;
    if (kind === "screenAudio") return this.screenStream?.getAudioTracks()[0] ?? null;
    return this.screenStream?.getVideoTracks()[0] ?? null;
  }

  /** Push one media slot to every peer without touching the other slots. */
  private applyLocalTrack(kind: MediaKind, track: MediaStreamTrack | null) {
    for (const peer of this.peers.values()) {
      void peer.transceivers[kind]?.sender.replaceTrack(track).catch(() => undefined);
    }
  }

  /** Bind the offer's m-lines to our media slots (answering side only). */
  private bindTransceivers(peer: Peer) {
    for (const transceiver of peer.pc.getTransceivers()) {
      const kind =
        transceiver.mid === "0"
          ? "mic"
          : transceiver.mid === "1"
            ? "camera"
            : transceiver.mid === "2"
              ? "screen"
              : transceiver.mid === "3"
                ? "screenAudio"
                : null;
      if (!kind || peer.transceivers[kind]) continue;
      peer.transceivers[kind] = transceiver;
      try {
        transceiver.direction = "sendrecv";
      } catch {
        /* direction already fixed by the remote description */
      }
      void transceiver.sender.replaceTrack(this.localTrack(kind)).catch(() => undefined);
    }
  }

  private updateRemote(userId: string, kind: MediaKind, stream: MediaStream | null) {
    const screenState = this.remoteScreens.get(userId);
    if (
      (kind === "screen" || kind === "screenAudio") &&
      screenState &&
      (!screenState.active || (kind === "screenAudio" && !screenState.hasAudio))
    )
      stream = null;
    const current = this.remote[userId] ?? {
      audio: null,
      camera: null,
      screen: null,
      screenAudio: null,
    };
    const key = kind === "mic" ? "audio" : kind;
    if (current[key] === stream) return;
    this.remote = { ...this.remote, [userId]: { ...current, [key]: stream } };
    this.emitRemote();
  }

  private emitRemote() {
    this.syncRemoteDetectors();
    this.events.onRemoteMedia?.({ ...this.remote });
  }

  private syncRemoteDetectors() {
    const context = this.audioPipeline?.context;
    if (!context || this.disposed) return;
    for (const [id, detector] of this.remoteDetectors) {
      const track = this.remote[id]?.audio?.getAudioTracks()[0];
      if (track === detector.track && track.readyState === "live") continue;
      detector.source.disconnect();
      detector.analyser.disconnect();
      this.remoteDetectors.delete(id);
    }
    for (const [id, media] of Object.entries(this.remote)) {
      const track = media.audio?.getAudioTracks()[0];
      if (!track || track.readyState !== "live" || this.remoteDetectors.has(id)) continue;
      try {
        // Analyse received microphone audio before playback volume/deafen.
        // A silent sink keeps the graph running without playing audio twice.
        if (!this.detectionSink) {
          this.detectionSink = context.createGain();
          this.detectionSink.gain.value = 0;
          this.detectionSink.connect(context.destination);
        }
        const source = context.createMediaStreamSource(new MediaStream([track]));
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyser.connect(this.detectionSink);
        this.remoteDetectors.set(id, {
          track,
          source,
          analyser,
          buffer: new Uint8Array(analyser.frequencyBinCount),
          lastActivity: 0,
        });
      } catch {
        // Presence remains available when a received track cannot be analysed.
      }
    }
    this.detectRemoteSpeaking(performance.now());
  }

  private detectRemoteSpeaking(now: number) {
    const next: Record<string, boolean> = {};
    for (const [id, detector] of this.remoteDetectors) {
      detector.analyser.getByteTimeDomainData(detector.buffer);
      let peak = 0;
      for (const value of detector.buffer) peak = Math.max(peak, Math.abs(value - 128));
      if (detector.track.readyState === "live" && !detector.track.muted && peak > 8)
        detector.lastActivity = now;
      next[id] =
        detector.track.readyState === "live" &&
        !detector.track.muted &&
        detector.lastActivity > 0 &&
        now - detector.lastActivity < 240;
    }
    if (
      Object.keys(next).length !== Object.keys(this.remoteSpeaking).length ||
      Object.entries(next).some(([id, value]) => this.remoteSpeaking[id] !== value)
    ) {
      this.remoteSpeaking = next;
      this.events.onRemoteSpeakingChange?.({ ...next });
    }
  }

  /* ------------------------------------------------------------- signaling */

  private send(to: string, data: Omit<SignalPayload, "from" | "to">) {
    if (this.disposed) return;
    void this.signaling?.send({
      type: "broadcast",
      event: "signal",
      payload: { from: this.userId, from_session: this.sessionId, to, ...data },
    });
  }

  private broadcast(data: Omit<SignalPayload, "from" | "to">) {
    this.send("*", data);
  }

  private async onSignal(payload: SignalPayload) {
    if (this.disposed || payload.from === this.userId) return;
    if (payload.to !== this.userId && payload.to !== "*") return;

    // A participant that leaves and immediately returns has a new signaling
    // session. Never negotiate that session over the closed peer connection.
    const existing = this.peers.get(payload.from);
    if (
      (payload.screenStarted || payload.screenStopped) &&
      existing?.remoteSessionId &&
      payload.from_session &&
      existing.remoteSessionId !== payload.from_session
    )
      return;
    if (payload.bye) {
      if (
        existing &&
        (!existing.remoteSessionId || existing.remoteSessionId === payload.from_session)
      ) {
        this.closePeer(payload.from, existing);
        this.emitAggregateState();
      }
      return;
    }
    if (
      existing &&
      payload.from_session &&
      existing.remoteSessionId &&
      existing.remoteSessionId !== payload.from_session
    ) {
      this.closePeer(payload.from, existing);
    }

    if (payload.screenStopped) {
      this.remoteScreens.set(payload.from, { active: false, hasAudio: false });
      this.updateRemote(payload.from, "screen", null);
      this.updateRemote(payload.from, "screenAudio", null);
      return;
    }
    if (payload.screenStarted) {
      this.remoteScreens.set(payload.from, { active: true, hasAudio: !!payload.screenHasAudio });
      const peer = this.peers.get(payload.from);
      if (peer) {
        for (const kind of ["screen", "screenAudio"] as const) {
          const stream = peer.streams[kind];
          const track = stream.getTracks()[0];
          this.updateRemote(
            payload.from,
            kind,
            (kind !== "screenAudio" || payload.screenHasAudio) &&
              track &&
              shouldExposeRemoteTrack(kind, track)
              ? stream
              : null,
          );
        }
      }
      return;
    }

    if (payload.hello) {
      const peer = this.peers.get(payload.from) ?? this.createPeer(payload.from);
      if (payload.from_session) peer.remoteSessionId = payload.from_session;
      // Reply directly so the newcomer learns about us too (but never loop).
      if (payload.to === "*") this.send(payload.from, { hello: true });
      this.send(
        payload.from,
        this.screenStream
          ? { screenStarted: true, screenHasAudio: this.screenShareHasAudio }
          : { screenStopped: true },
      );
      // Repair: our previous offer may have been sent before this peer was
      // subscribed, leaving us stuck in have-local-offer forever.
      if (peer.pc.signalingState === "have-local-offer" && peer.pc.localDescription)
        this.send(payload.from, { description: peer.pc.localDescription.toJSON() });
      this.emitAggregateState();
      return;
    }

    const peer = this.peers.get(payload.from) ?? this.createPeer(payload.from);
    if (payload.from_session) peer.remoteSessionId = payload.from_session;
    const operation = peer.signalQueue.then(() => this.applySignal(peer, payload));
    peer.signalQueue = operation.catch(() => undefined);
    await operation;
  }

  private async applySignal(peer: Peer, payload: SignalPayload) {
    if (this.disposed || this.peers.get(payload.from) !== peer) return;
    const { pc } = peer;

    try {
      if (payload.description) {
        const description = payload.description;
        // A hello can resend the initial offer. Applying it twice concurrently
        // would make the second implicit setLocalDescription create an OFFER
        // instead of an answer, leaving both participants waiting forever.
        if (
          pc.remoteDescription?.type === description.type &&
          pc.remoteDescription.sdp === description.sdp
        ) {
          if (description.type === "offer" && pc.localDescription?.type === "answer")
            this.send(payload.from, { description: pc.localDescription.toJSON() });
          return;
        }
        if (description.type === "answer" && pc.signalingState !== "have-local-offer") return;
        const offerCollision =
          description.type === "offer" && (peer.makingOffer || pc.signalingState !== "stable");
        peer.ignoreOffer = !peer.polite && offerCollision;
        if (peer.ignoreOffer) {
          // Keep our own offer, but make sure the peer actually received it.
          if (pc.localDescription)
            this.send(payload.from, { description: pc.localDescription.toJSON() });
          return;
        }

        await pc.setRemoteDescription(description);
        if (this.disposed || this.peers.get(payload.from) !== peer) return;
        // Answering side: adopt the offerer's m-lines (mic/camera/screen by mid)
        // and start sending our own media on them.
        if (description.type === "offer") this.bindTransceivers(peer);
        await this.flushCandidates(peer);
        if (description.type === "offer") {
          await pc.setLocalDescription();
          if (this.disposed || this.peers.get(payload.from) !== peer) return;
          if (pc.localDescription)
            this.send(payload.from, { description: pc.localDescription.toJSON() });
        }
      } else if (payload.candidate) {
        // Candidates can outrun the description — buffer instead of dropping.
        if (!pc.remoteDescription) peer.pendingCandidates.push(payload.candidate);
        else await pc.addIceCandidate(payload.candidate).catch(() => undefined);
      }
    } catch {
      /* transient signaling error; negotiation will retry */
    }
  }

  private async flushCandidates(peer: Peer) {
    const queued = peer.pendingCandidates;
    peer.pendingCandidates = [];
    for (const candidate of queued) {
      await peer.pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  /* -------------------------------------------------------------- controls */

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMuteToTracks();
  }

  /** Only the pipeline destination may be sent; never bypass DSP with the raw microphone. */
  private outgoingAudioTrack(): MediaStreamTrack | null {
    return this.processedStream?.getAudioTracks()[0] ?? null;
  }

  setInputGain(percent: number) {
    this.inputGain = Math.max(0, Math.min(200, percent)) / 100;
    if (this.gainNode) this.gainNode.gain.value = this.inputGain;
  }

  private applyMuteToTracks() {
    this.audioPipeline?.setMuted(this.muted);
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
    if (this.disposed) throw new DOMException("Voice session ended", "AbortError");
    const generation = ++this.cameraGeneration;
    const id = deviceId ?? this.devices.cameraId;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { ...CAMERA_CONSTRAINTS, ...(id ? { deviceId: { exact: id } } : {}) },
    });
    if (this.disposed || generation !== this.cameraGeneration) {
      stopStream(stream);
      throw new DOMException("Voice session ended", "AbortError");
    }
    stopStream(this.cameraStream);
    this.cameraStream = stream;
    const track = stream.getVideoTracks()[0] ?? null;
    track?.addEventListener("ended", () => this.disableCamera());
    this.applyLocalTrack("camera", track);
    this.events.onLocalMedia?.({ camera: stream, screen: this.screenStream });
  }

  disableCamera() {
    this.cameraGeneration += 1;
    if (!this.cameraStream) return;
    stopStream(this.cameraStream);
    this.cameraStream = null;
    this.applyLocalTrack("camera", null);
    this.events.onLocalMedia?.({ camera: null, screen: this.screenStream });
  }

  async startScreenShare() {
    if (this.disposed) throw new DOMException("Voice session ended", "AbortError");
    const generation = ++this.screenGeneration;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 15, max: 30 } },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        restrictOwnAudio: true,
      },
      systemAudio: "include",
      selfBrowserSurface: "exclude",
    } as DisplayMediaStreamOptions);
    if (this.disposed || generation !== this.screenGeneration) {
      stopStream(stream);
      throw new DOMException("Voice session ended", "AbortError");
    }
    stopStream(this.screenStream);
    this.screenStream = stream;
    const track = stream.getVideoTracks()[0] ?? null;
    track?.addEventListener("ended", () => {
      if (this.screenStream !== stream) return;
      this.stopScreenShare();
      this.events.onScreenShareEnded?.();
    });
    this.applyLocalTrack("screen", track);
    const audioTrack = stream.getAudioTracks()[0] ?? null;
    audioTrack?.addEventListener("ended", () => {
      if (this.screenStream === stream) this.applyLocalTrack("screenAudio", null);
    });
    this.applyLocalTrack("screenAudio", audioTrack);
    this.broadcast({ screenStarted: true, screenHasAudio: !!audioTrack });
    this.events.onLocalMedia?.({ camera: this.cameraStream, screen: stream });
  }

  stopScreenShare() {
    this.screenGeneration += 1;
    if (!this.screenStream) return;
    stopStream(this.screenStream);
    this.screenStream = null;
    this.applyLocalTrack("screen", null);
    this.applyLocalTrack("screenAudio", null);
    this.broadcast({ screenStopped: true });
    this.events.onLocalMedia?.({ camera: this.cameraStream, screen: null });
  }

  async setDevices(devices: DeviceIds) {
    if (this.disposed) throw new DOMException("Voice session ended", "AbortError");
    const previous = this.devices;
    this.devices = { ...previous, ...devices };

    if (
      "microphoneId" in devices &&
      (devices.microphoneId ?? null) !== (previous.microphoneId ?? null) &&
      this.micStream
    ) {
      const generation = ++this.microphoneGeneration;
      const stream = await navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: this.noiseSuppression !== "off",
            autoGainControl: true,
            ...(devices.microphoneId ? { deviceId: { exact: devices.microphoneId } } : {}),
          },
        })
        .catch((error: unknown) => {
          if (!this.disposed && generation === this.microphoneGeneration)
            this.devices = { ...this.devices, microphoneId: previous.microphoneId ?? null };
          throw error;
        });
      if (this.disposed || generation !== this.microphoneGeneration) {
        stopStream(stream);
        throw new DOMException("Voice session ended", "AbortError");
      }
      stopStream(this.micStream);
      this.micStream = stream;
      this.applyMuteToTracks();
      await this.startSpeakingDetection();
      this.applyLocalTrack("mic", this.outgoingAudioTrack());
    }

    if (devices.cameraId && devices.cameraId !== previous.cameraId && this.cameraStream) {
      await this.enableCamera(devices.cameraId);
    }
  }

  /* ----------------------------------------------------- speaking detection */

  async setNoiseSuppression(mode: NoiseSuppressionMode) {
    this.noiseSuppression = mode;
    await this.audioPipeline?.setMode(mode);
  }

  private async startSpeakingDetection() {
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    if (!this.micStream || this.disposed) return;
    this.audioPipeline ??= new MicrophoneAudioPipeline((status) => {
      if (!this.disposed) this.events.onNoiseProcessingChange?.(status);
    });
    const pipeline = this.audioPipeline;
    pipeline.attachMicrophone(this.micStream);
    pipeline.setGain(this.inputGain * 100);
    pipeline.setMuted(this.muted);
    this.gainNode = pipeline.gain;
    this.analyser = pipeline.analyser;
    this.processedStream = pipeline.stream;

    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    let lastActivity = 0;
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128));
      const now = performance.now();
      this.detectRemoteSpeaking(now);
      if (!this.muted && peak > 8) lastActivity = now;
      // Keep the ring visible across short pauses between syllables.
      const speaking = !this.muted && lastActivity > 0 && now - lastActivity < 240;
      if (speaking !== this.speaking) {
        this.speaking = speaking;
        this.events.onSpeakingChange?.(speaking);
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    await pipeline.setMode(this.noiseSuppression);
  }
}

interface SignalPayload {
  from: string;
  from_session?: string;
  /** Target user id, or "*" for a room-wide announcement. */
  to: string;
  hello?: boolean;
  bye?: boolean;
  screenStopped?: boolean;
  screenStarted?: boolean;
  screenHasAudio?: boolean;
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
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getDisplayMedia === "function"
  );
}

export function supportsCamera(): boolean {
  return (
    typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}
