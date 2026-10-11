/** Screen-only quality control. No signaling, audio processing, database or telemetry. */
export interface ScreenShareOptions {
  resolution: 720 | 1080 | 1440;
  fps: 15 | 30 | 60;
  mode: "auto" | "performance" | "quality";
  audio: boolean;
}
export const DEFAULT_SCREEN_OPTIONS: ScreenShareOptions = {
  resolution: 1080,
  fps: 30,
  mode: "auto",
  audio: true,
};
export function normalizeScreenOptions(
  value: Partial<ScreenShareOptions> = {},
): ScreenShareOptions {
  return {
    resolution: [720, 1080, 1440].includes(value.resolution ?? 0) ? value.resolution! : 1080,
    fps: [15, 30, 60].includes(value.fps ?? 0) ? value.fps! : 30,
    mode: ["auto", "performance", "quality"].includes(value.mode ?? "") ? value.mode! : "auto",
    audio: typeof value.audio === "boolean" ? value.audio : true,
  };
}
export function screenConstraints(options: ScreenShareOptions): MediaTrackConstraints {
  return {
    width: {
      ideal: Math.round((options.resolution * 16) / 9),
      max: Math.round((options.resolution * 16) / 9),
    },
    height: { ideal: options.resolution, max: options.resolution },
    frameRate: { ideal: options.fps, max: options.fps },
  };
}
export function screenBitrate(options: ScreenShareOptions): number {
  const pixels = (options.resolution / 720) ** 1.6;
  return Math.round(3_000_000 * pixels * (options.fps / 30) ** 0.8);
}
export interface ScreenPeerStats {
  width: number | null;
  height: number | null;
  fps: number | null;
  bitrate: number | null;
  loss: number | null;
  rtt: number | null;
  limitation: string | null;
  codec: string | null;
  encoder: string | null;
  status: "waiting" | "sending" | "unavailable";
}
export interface ScreenShareSnapshot {
  active: boolean;
  requested: ScreenShareOptions;
  capture: {
    width: number | null;
    height: number | null;
    fps: number | null;
    audio: boolean;
  } | null;
  peers: ScreenPeerStats[];
  warning: string | null;
}
interface Sample {
  time: number;
  bytes: number;
  frames: number;
  lost: number | null;
  received: number | null;
}
interface RemoteScreenStats {
  packetsLost?: number;
  packetsReceived?: number;
  fractionLost?: number;
  roundTripTime?: number;
}
interface Link {
  sender: RTCRtpSender;
  previous: Sample | null;
  stats: ScreenPeerStats;
  factor: number;
  bad: number;
  good: number;
  changed: number;
  queue: Promise<void>;
  configured: boolean;
}
const emptyStats = (): ScreenPeerStats => ({
  width: null,
  height: null,
  fps: null,
  bitrate: null,
  loss: null,
  rtt: null,
  limitation: null,
  codec: null,
  encoder: null,
  status: "waiting",
});
const finite = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Hysteresis: two poor samples to decrease; three good samples to recover. */
export function adaptScreenLink(
  link: Pick<Link, "factor" | "bad" | "good" | "changed">,
  stats: ScreenPeerStats,
  mode: ScreenShareOptions["mode"],
  now: number,
) {
  const bad =
    (stats.loss ?? 0) > (mode === "quality" ? 0.06 : 0.035) ||
    (stats.rtt ?? 0) > 0.35 ||
    stats.limitation === "cpu" ||
    stats.limitation === "bandwidth";
  const measured = stats.loss !== null || stats.rtt !== null || stats.limitation !== null;
  if (!measured || stats.status !== "sending") return;
  link.bad = bad ? link.bad + 1 : 0;
  link.good = bad ? 0 : link.good + 1;
  if (now - link.changed < 12_000) return;
  const next =
    link.bad >= 2
      ? Math.max(0.12, link.factor * 0.75)
      : link.good >= 3
        ? Math.min(1, link.factor * 1.15)
        : link.factor;
  if (next !== link.factor) {
    link.factor = next;
    link.changed = now;
    link.bad = link.good = 0;
  }
}

export class ScreenShareController {
  private track: MediaStreamTrack | null = null;
  private audio = false;
  private options = DEFAULT_SCREEN_OPTIONS;
  private links = new Map<RTCRtpSender, Link>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private updateQueue: Promise<void> = Promise.resolve();
  private snapshot: ScreenShareSnapshot = {
    active: false,
    requested: DEFAULT_SCREEN_OPTIONS,
    capture: null,
    peers: [],
    warning: null,
  };
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snapshot;
  private publish(warning: string | null = this.snapshot.warning) {
    const settings = this.track?.getSettings();
    this.snapshot = {
      active: !!this.track && this.track.readyState === "live",
      requested: this.options,
      capture: settings
        ? {
            width: finite(settings.width),
            height: finite(settings.height),
            fps: finite(settings.frameRate),
            audio: this.audio,
          }
        : null,
      peers: [...this.links.values()].map((link) => ({ ...link.stats })),
      warning,
    };
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* Observer cannot break media. */
      }
    });
  }
  start(track: MediaStreamTrack, options: ScreenShareOptions, audio: boolean) {
    this.stop();
    this.track = track;
    this.options = normalizeScreenOptions(options);
    this.audio = audio;
    this.setHint();
    this.publish(null);
    this.schedule();
  }
  private setHint() {
    try {
      if (this.track)
        this.track.contentHint = this.options.mode === "quality" ? "detail" : "motion";
    } catch {
      /* Optional browser hint. */
    }
  }
  /** Constraints are serialized and never replace/stop the capture or voice tracks. */
  update(options: ScreenShareOptions): Promise<void> {
    const generation = this.generation;
    const operation = this.updateQueue.then(async () => {
      const track = this.track;
      if (!track || generation !== this.generation)
        throw new DOMException("Capture ended", "AbortError");
      const next = normalizeScreenOptions(options);
      // Audio source changes require a new explicit source selection; avoid silent recapture.
      next.audio = this.options.audio;
      await track.applyConstraints(screenConstraints(next));
      if (generation !== this.generation || track !== this.track) return;
      this.options = next;
      this.setHint();
      await Promise.all([...this.links.values()].map((link) => this.configure(link)));
      this.publish();
    });
    this.updateQueue = operation.catch(() => {});
    return operation;
  }
  attach(sender: RTCRtpSender) {
    if (!this.track || sender.track !== this.track || this.links.has(sender)) return;
    const link: Link = {
      sender,
      previous: null,
      stats: emptyStats(),
      factor: 1,
      bad: 0,
      good: 0,
      changed: 0,
      queue: Promise.resolve(),
      configured: false,
    };
    this.links.set(sender, link);
    void this.configure(link);
    this.publish();
    this.schedule();
  }
  detach(sender: RTCRtpSender) {
    this.links.delete(sender);
    this.publish();
  }
  setAudioAvailable(audio: boolean) {
    this.audio = audio;
    this.publish();
  }
  warn() {
    this.publish(
      "Este cliente não conseguiu aplicar todos os ajustes de vídeo. A chamada de voz permanece ativa; confira os valores reais da transmissão.",
    );
  }
  private configure(link: Link, retryOnly = false) {
    const generation = this.generation;
    const operation = link.queue
      .then(async () => {
        if (generation !== this.generation || !this.track || !this.links.has(link.sender)) return;
        if (retryOnly && link.configured) return;
        if (
          typeof link.sender.getParameters !== "function" ||
          typeof link.sender.setParameters !== "function"
        )
          return;
        const params = link.sender.getParameters();
        // Never invent encodings or modify transactionId, codecs, RID or SSRC.
        if (!params.encodings?.length) return;
        for (const encoding of params.encodings) {
          encoding.maxBitrate = Math.max(
            250_000,
            Math.round(screenBitrate(this.options) * link.factor),
          );
          encoding.maxFramerate = this.options.fps;
          encoding.scaleResolutionDownBy =
            link.factor < 0.7 ? Math.min(2.5, 1 / Math.sqrt(link.factor)) : 1;
        }
        params.degradationPreference =
          this.options.mode === "quality" ? "maintain-resolution" : "maintain-framerate";
        try {
          await link.sender.setParameters(params);
        } catch {
          if (generation !== this.generation || !this.links.has(link.sender)) return;
          // Some engines reject the optional degradation/scale hints. Retry
          // the portable budget/FPS controls with a fresh transaction.
          const fallback = link.sender.getParameters();
          if (!fallback.encodings?.length) return;
          delete fallback.degradationPreference;
          for (const encoding of fallback.encodings) {
            delete encoding.scaleResolutionDownBy;
            encoding.maxBitrate = Math.max(
              250_000,
              Math.round(screenBitrate(this.options) * link.factor),
            );
            encoding.maxFramerate = this.options.fps;
          }
          await link.sender.setParameters(fallback);
        }
        link.configured = true;
      })
      .catch(() => {
        if (generation === this.generation && this.track) this.warn();
      });
    link.queue = operation;
    return operation;
  }
  private schedule() {
    if (!this.track || !this.links.size || this.timer) return;
    const delay =
      typeof document !== "undefined" && document.hidden
        ? 10_000
        : this.options.mode === "performance"
          ? 8000
          : 4000;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sample().finally(() => this.schedule());
    }, delay);
  }
  /** One stats request per active screen sender, no interval overlap, no voice sampling. */
  async sample() {
    const generation = this.generation;
    for (const link of this.links.values()) {
      if (!this.track || generation !== this.generation) break;
      if (link.sender.track !== this.track || typeof link.sender.getStats !== "function") continue;
      try {
        if (!link.configured) await this.configure(link, true);
        const report = await link.sender.getStats();
        if (generation !== this.generation || !this.links.has(link.sender)) continue;
        let found: RTCOutboundRtpStreamStats | null = null;
        report.forEach((item) => {
          if (
            item.type === "outbound-rtp" &&
            !item.isRemote &&
            (item.kind === "video" || item.mediaType === "video")
          )
            found = item;
        });
        const outbound = found as
          (RTCOutboundRtpStreamStats & { encoderImplementation?: string }) | null;
        if (!outbound) continue;
        const remote = (
          outbound.remoteId ? report.get(outbound.remoteId) : null
        ) as RemoteScreenStats | null;
        const codec = outbound.codecId ? report.get(outbound.codecId) : null;
        const sample: Sample = {
          time: outbound.timestamp,
          bytes: outbound.bytesSent ?? 0,
          frames: outbound.framesEncoded ?? 0,
          lost: finite(remote?.packetsLost),
          received: finite(remote?.packetsReceived),
        };
        const previous = link.previous,
          dt = previous ? (sample.time - previous.time) / 1000 : 0;
        const lost =
          previous?.lost !== null && previous?.lost !== undefined && sample.lost !== null
            ? sample.lost - previous.lost
            : null;
        const received =
          previous?.received !== null &&
          previous?.received !== undefined &&
          sample.received !== null
            ? sample.received - previous.received
            : null;
        link.stats = {
          width: finite(outbound.frameWidth),
          height: finite(outbound.frameHeight),
          fps:
            finite(outbound.framesPerSecond) ??
            (dt > 0 && previous ? Math.max(0, (sample.frames - previous.frames) / dt) : null),
          bitrate:
            dt > 0 && previous && sample.bytes >= previous.bytes
              ? ((sample.bytes - previous.bytes) * 8) / dt
              : null,
          loss:
            lost !== null && received !== null && lost >= 0 && received >= 0 && lost + received > 0
              ? lost / (lost + received)
              : finite(remote?.fractionLost),
          rtt: finite(remote?.roundTripTime),
          limitation:
            typeof outbound.qualityLimitationReason === "string"
              ? outbound.qualityLimitationReason
              : null,
          codec: typeof codec?.mimeType === "string" ? codec.mimeType : null,
          encoder:
            typeof outbound.encoderImplementation === "string"
              ? outbound.encoderImplementation
              : null,
          status: sample.bytes > 0 ? "sending" : "waiting",
        };
        link.previous = sample;
        const factor = link.factor;
        adaptScreenLink(link, link.stats, this.options.mode, Date.now());
        if (factor !== link.factor) await this.configure(link);
      } catch {
        link.stats = { ...emptyStats(), status: "unavailable" };
      }
    }
    if (generation === this.generation) this.publish();
  }
  stop() {
    this.generation++;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.track = null;
    this.audio = false;
    this.links.clear();
    this.publish(null);
  }
}
