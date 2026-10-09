import type { RealtimeChannel } from "@supabase/supabase-js";

/** Recover a closed presence channel without reconnecting unrelated call channels. */
export function maintainPresence(options: {
  create: () => RealtimeChannel;
  remove: (channel: RealtimeChannel) => Promise<unknown>;
  payload: () => object;
  payloadKey?: (payload: object) => string;
  connected: () => void;
  disconnected: () => void;
  sync: (channel: RealtimeChannel) => void;
  available: () => boolean;
}) {
  let channel: RealtimeChannel | null = null;
  let stopped = false,
    subscribed = false,
    tracking = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;
  let lastPayloadKey: string | null = null;
  let trackPending = false;
  let confirmed = false;
  let publicationEpoch = 0;
  let work = Promise.resolve();
  const cancelRetry = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const retry = () => {
    if (stopped) return;
    if (!subscribed || !confirmed) options.disconnected();
    if (timer !== undefined || !options.available()) return;
    timer = setTimeout(
      () => {
        timer = undefined;
        if (channel && subscribed) void track();
        else void restart();
      },
      subscribed ? Math.min(30000, 2000 * 2 ** Math.min(failures++, 4)) : 30000,
    );
  };
  const track = async () => {
    const current = channel;
    if (stopped || !options.available()) return;
    if (!current || !subscribed) {
      retry();
      return;
    }
    if (tracking) {
      trackPending = true;
      return;
    }
    const payload = options.payload();
    const key = options.payloadKey?.(payload);
    if (key !== undefined && key === lastPayloadKey) return;
    tracking = true;
    const epoch = publicationEpoch;
    try {
      const result = await current.track(payload);
      if (stopped || channel !== current || epoch !== publicationEpoch) return;
      if (result === "ok") {
        confirmed = true;
        lastPayloadKey = key ?? null;
        failures = 0;
        cancelRetry();
        options.connected();
        options.sync(current);
      } else {
        lastPayloadKey = null;
        retry();
      }
    } catch {
      if (!stopped && channel === current && epoch === publicationEpoch) {
        lastPayloadKey = null;
        retry();
      }
    } finally {
      if (channel === current) {
        tracking = false;
        if (trackPending) {
          trackPending = false;
          void track();
        }
      }
    }
  };
  const restart = () => {
    work = work
      .catch(() => undefined)
      .then(async () => {
        if (stopped) return;
        cancelRetry();
        const old = channel;
        channel = null;
        subscribed = false;
        tracking = false;
        lastPayloadKey = null;
        trackPending = false;
        confirmed = false;
        if (old) await options.remove(old);
        if (stopped || !options.available()) return;
        const current = options.create();
        channel = current;
        current.on("presence", { event: "sync" }, () => {
          if (!stopped && channel === current && subscribed && options.available())
            options.sync(current);
        });
        current.subscribe((state) => {
          if (stopped || channel !== current) return;
          subscribed = state === "SUBSCRIBED";
          if (subscribed) {
            lastPayloadKey = null;
            cancelRetry();
            void track();
          } else retry();
        });
      })
      .catch(retry);
    return work;
  };
  return {
    start: restart,
    track: () => {
      void track();
    },
    offline: () => {
      publicationEpoch++;
      lastPayloadKey = null;
      confirmed = false;
      trackPending = false;
      options.disconnected();
      cancelRetry();
      if (channel) void channel.untrack().catch(() => undefined);
    },
    async stop() {
      stopped = true;
      cancelRetry();
      await work;
      const old = channel;
      channel = null;
      if (old) await options.remove(old);
    },
  };
}
