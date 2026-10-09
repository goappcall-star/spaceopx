import {
  shouldApplyVoiceMove,
  type VoiceMoveRequest,
  type VoiceRestriction,
} from "@/services/voice-moderation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

import { useAudioSettings } from "@/hooks/use-audio-settings";
import { supabase } from "@/integrations/supabase/client";
import {
  createVoiceProvider,
  type DeviceIds,
  type MediaDeviceList,
  type RemoteMedia,
  type VoiceProvider,
} from "@/services/voice";
import type { VoiceConnectionState, VoiceParticipant } from "@/types";
import { reportDesktopCall, clearDesktopCall, beginDesktopCall } from "@/services/desktop-updates";

export type MediaPermission = "unknown" | "granted" | "denied" | "unavailable";

interface VoiceContextValue {
  connectionState: VoiceConnectionState;
  activeChannelId: string | null;
  activeServerId: string | null;
  /** channel_id -> participants, for the whole server (sidebar rendering). */
  participantsByChannel: Record<string, VoiceParticipant[]>;
  muted: boolean;
  deafened: boolean;
  restrictions: Record<string, VoiceRestriction>;
  cameraOn: boolean;
  screenOn: boolean;
  transmitsAudio: boolean;
  volumes: Record<string, number>;
  hiddenVideos: Record<string, boolean>;
  setVideoHidden: (userId: string, hidden: boolean) => void;
  remoteMedia: Record<string, RemoteMedia>;
  localCamera: MediaStream | null;
  localScreen: MediaStream | null;
  cameraPermission: MediaPermission;
  micPermission: MediaPermission;
  devices: MediaDeviceList;
  selectedDevices: {
    microphoneId?: string | undefined;
    cameraId?: string | undefined;
    outputId?: string | undefined;
  };
  join: (channelId: string, serverId?: string, listenOnly?: boolean) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  /** True while a push-to-talk key is held (always true in open-mic mode). */
  pttActive: boolean;
  selectDevice: (kind: "microphoneId" | "cameraId" | "outputId", deviceId: string) => Promise<void>;
  setUserVolume: (userId: string, volume: number) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);
const VOLUME_KEY = "securechat:voice-volumes";
const DEVICE_KEY = "securechat:voice-devices";

// The SDK caches channels by topic. A replacement must wait for the previous
// owner (including an observer) to finish removing that exact subscription.
const presenceReleases = new Map<string, Promise<void>>();
function ownPresenceTopic(topic: string, start: () => () => Promise<void>) {
  let disposed = false;
  let cleanup: (() => Promise<void>) | undefined;
  const previous = presenceReleases.get(topic);
  const ready = previous?.then(() => {
    if (!disposed) cleanup = start();
  });
  if (!previous) cleanup = start();
  return () => {
    disposed = true;
    const release = (ready ? ready.then(() => cleanup?.()) : Promise.resolve(cleanup?.())).catch(
      () => undefined,
    );
    presenceReleases.set(topic, release);
    void release.then(() => {
      if (presenceReleases.get(topic) === release) presenceReleases.delete(topic);
    });
  };
}

async function releasePresence(channel: RealtimeChannel) {
  // Bound departure acknowledgements, then remove before any replacement is
  // created. Never disconnect the shared Realtime client or the RTC channel.
  await channel.untrack({ timeout: 1000 }).catch(() => undefined);
  await channel.unsubscribe?.(500).catch(() => undefined);
  await supabase.removeChannel(channel);
}

type VoicePresenceMeta = VoiceParticipant & {
  channel_id: string | null;
  voice_session_id?: string;
  updated_at?: number;
};

function readOccupancy(state: Record<string, VoicePresenceMeta[]>) {
  const newest = new Map<string, VoicePresenceMeta>();
  for (const entries of Object.values(state))
    for (const entry of entries) {
      if (!entry.channel_id) continue;
      const previous = newest.get(entry.user_id);
      if (!previous || (entry.updated_at ?? 0) > (previous.updated_at ?? 0))
        newest.set(entry.user_id, entry);
    }
  const rooms: Record<string, VoiceParticipant[]> = {};
  for (const entry of newest.values()) (rooms[entry.channel_id!] ??= []).push(entry);
  return rooms;
}

// A missing snapshot is not an explicit departure. Keep a short recovery
// window, but apply room moves and explicit session departures immediately.
function occupancyView() {
  let rooms: Record<string, VoiceParticipant[]> = {};
  const missing = new Map<string, number>();
  const departed = new Set<string>();
  const key = (entry: VoiceParticipant) => `${entry.user_id}:${entry.voice_session_id ?? "legacy"}`;
  return {
    read(state: Record<string, VoicePresenceMeta[]>) {
      const next = readOccupancy(state);
      const present = new Set(
        Object.values(next)
          .flat()
          .map((entry) => entry.user_id),
      );
      for (const entries of Object.values(state))
        for (const entry of entries) {
          if (!entry.channel_id && entry.voice_session_id) {
            departed.add(key(entry));
            if (departed.size > 200) departed.delete(departed.values().next().value!);
          }
        }
      const now = Date.now();
      for (const [room, entries] of Object.entries(rooms))
        for (const entry of entries) {
          const id = key(entry);
          if (present.has(entry.user_id) || departed.has(id)) {
            missing.delete(id);
            continue;
          }
          const since = missing.get(id) ?? now;
          missing.set(id, since);
          if (now - since < 30000) (next[room] ??= []).push(entry);
          else missing.delete(id);
        }
      for (const room of Object.keys(next)) {
        next[room] = next[room]!.filter((entry) => !departed.has(key(entry)));
        if (!next[room]!.length) delete next[room];
      }
      rooms = next;
      return next;
    },
  };
}

export function VoiceProviderRoot({
  serverId,
  userId,
  children,
}: {
  serverId: string | null;
  userId: string | undefined;
  children: ReactNode;
}) {
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>("disconnected");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const presenceServerId = activeServerId ?? serverId;
  const voiceServerRef = useRef<string | null>(null);
  const channelServerRef = useRef<string | null>(null);
  const [observedParticipants, setObservedParticipants] = useState<
    Record<string, VoiceParticipant[]>
  >({});
  const [presenceRevision, setPresenceRevision] = useState(0);
  const [observerRevision, setObserverRevision] = useState(0);
  const [participantsByChannel, setParticipants] = useState<Record<string, VoiceParticipant[]>>({});
  const [localMuted, setMuted] = useState(false);
  const [localDeafened, setDeafened] = useState(false);
  const [restrictions, setRestrictions] = useState<Record<string, VoiceRestriction>>({});
  const restrictionRef = useRef<Record<string, VoiceRestriction>>({});
  const ownRestriction = userId ? restrictions[`${presenceServerId}:${userId}`] : undefined;
  const muted = localMuted || Boolean(ownRestriction?.muted || ownRestriction?.deafened);
  const deafened = localDeafened || Boolean(ownRestriction?.deafened);
  useEffect(() => {
    const serverIds = [
      ...new Set([serverId, activeServerId].filter((id): id is string => Boolean(id))),
    ];
    if (!serverIds.length) {
      restrictionRef.current = {};
      setRestrictions({});
      return;
    }
    let disposed = false;
    let revision = 0;
    const load = async () => {
      const current = ++revision;
      const { data, error } = await supabase
        .from("voice_restrictions")
        .select("*")
        .in("server_id", serverIds);
      if (!disposed && current === revision && !error) {
        const next = Object.fromEntries(
          (data ?? []).map((row) => [`${row.server_id}:${row.user_id}`, row]),
        );
        restrictionRef.current = next;
        setRestrictions(next);
      }
    };
    const channel = supabase
      .channel(`voice-restrictions:${serverIds.join(":")}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "voice_restrictions",
          filter: `server_id=in.(${serverIds.join(",")})`,
        },
        () => {
          void load();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    void load();
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [serverId, activeServerId, userId]);
  const [speaking, setSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState<Record<string, boolean>>({});
  const [hiddenVideos, setHiddenVideos] = useState<Record<string, boolean>>({});
  const setVideoHidden = useCallback((id: string, hidden: boolean) => {
    setHiddenVideos((current) => ({ ...current, [id]: hidden }));
  }, []);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  useEffect(() => {
    reportDesktopCall(
      "voice",
      !!activeChannelId ||
        screenOn ||
        connectionState === "connecting" ||
        connectionState === "reconnecting",
    );
  }, [activeChannelId, screenOn, connectionState]);
  useEffect(() => () => clearDesktopCall("voice"), []);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [remoteMedia, setRemoteMedia] = useState<Record<string, RemoteMedia>>({});
  const [localCamera, setLocalCamera] = useState<MediaStream | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<MediaPermission>("unknown");
  const [micPermission, setMicPermission] = useState<MediaPermission>("unknown");
  const [cameraDeviceId, setCameraDeviceId] = useState<string | undefined>(undefined);
  const {
    settings: audioSettings,
    update: updateAudioSettings,
    devices,
    refreshDevices: refreshSharedDevices,
    reportNoiseProcessing,
  } = useAudioSettings();
  const [pttHeld, setPttHeld] = useState(false);

  const providerRef = useRef<VoiceProvider | null>(null);
  useEffect(() => {
    if (!activeChannelId) reportNoiseProcessing("voice", null);
    return () => reportNoiseProcessing("voice", null);
  }, [activeChannelId, reportNoiseProcessing]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const retryPresenceRef = useRef<((channel: RealtimeChannel) => void) | null>(null);
  const presenceRecoveredRef = useRef<(() => void) | null>(null);
  const presenceFailuresRef = useRef(0);
  const observerFailuresRef = useRef(0);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastPublishedRef = useRef<{ channel: RealtimeChannel; key: string } | null>(null);
  const sessionIdRef = useRef(crypto.randomUUID());
  const sessionStartedAtRef = useRef(Date.now());
  const occupancyViewsRef = useRef(new Map<string, ReturnType<typeof occupancyView>>());
  const participantOrderRef = useRef<Record<string, string[]>>({});
  const lifecycleQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lifecycleGenerationRef = useRef(0);
  const pendingJoinChannelRef = useRef<string | null>(null);
  const stateRef = useRef({ activeChannelId, muted, deafened, speaking, cameraOn, screenOn });
  stateRef.current = { activeChannelId, muted, deafened, speaking, cameraOn, screenOn };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw) setVolumes(JSON.parse(raw) as Record<string, number>);
      const rawDevices = localStorage.getItem(DEVICE_KEY);
      if (rawDevices) setCameraDeviceId((JSON.parse(rawDevices) as { cameraId?: string }).cameraId);
    } catch {
      /* ignore corrupted local settings */
    }
  }, []);

  const refreshDevices = refreshSharedDevices;

  const publishNow = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current || !userId) return;

    publishQueueRef.current = publishQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        // The provider may have switched servers while this update waited.
        if (channelRef.current !== channel || !subscribedRef.current) return;
        const snapshot = { ...stateRef.current, voiceSessionId: sessionIdRef.current };
        if (snapshot.activeChannelId && voiceServerRef.current !== channelServerRef.current) return;
        // Observers remain subscribed to Presence, but a null room is never rendered.
        const payload = {
          user_id: userId,
          channel_id: snapshot.activeChannelId,
          muted: snapshot.muted,
          deafened: snapshot.deafened,
          // Receivers detect speech from the actual incoming audio. VAD
          // bursts must not churn Presence or the shared signaling socket.
          speaking: false,
          camera: snapshot.cameraOn,
          screen: snapshot.screenOn,
          voice_session_id: snapshot.voiceSessionId,
        };
        const key = JSON.stringify(payload);
        if (lastPublishedRef.current?.channel === channel && lastPublishedRef.current.key === key)
          return;
        const result = await channel
          .track({ ...payload, updated_at: Date.now() }, { timeout: 10000 })
          .catch(() => "error" as const);
        if (channelRef.current !== channel) return;
        if (result === "ok") {
          lastPublishedRef.current = { channel, key };
          presenceRecoveredRef.current?.();
        } else {
          // A timed-out ack may still have applied on the server. The next
          // update must confirm the latest desired state, even if it equals
          // an older successful payload.
          lastPublishedRef.current = null;
          retryPresenceRef.current?.(channel);
        }
      });
  }, [userId]);

  const schedulePublish = useCallback(
    (immediate: boolean) => {
      if (immediate) {
        if (publishTimer.current) clearTimeout(publishTimer.current);
        publishTimer.current = null;
        publishNow();
      } else if (!publishTimer.current) {
        // Throttle, rather than debounce: continuous speech must not postpone
        // presence updates indefinitely.
        publishTimer.current = setTimeout(() => {
          publishTimer.current = null;
          publishNow();
        }, 500);
      }
    },
    [publishNow],
  );

  // One presence channel per server carries every voice room's occupancy.
  // The presence payload is republished whenever the channel (re)subscribes,
  // so a socket reconnect restores our slot instead of silently dropping it.
  useEffect(() => {
    if (!presenceServerId || !userId) {
      setParticipants({});
      return;
    }

    return ownPresenceTopic(`voice:${presenceServerId}`, () => {
      const view = occupancyViewsRef.current.get(presenceServerId) ?? occupancyView();
      occupancyViewsRef.current.set(presenceServerId, view);
      const channel = supabase.channel(`voice:${presenceServerId}`, {
        config: { presence: { key: `${userId}:${sessionIdRef.current}`, enabled: true } },
      });
      let disposed = false;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      const retry = (failed: RealtimeChannel, transport = false) => {
        if (disposed || failed !== channel || retryTimer) return;
        retryTimer = setTimeout(
          () => {
            retryTimer = null;
            if (disposed) return;
            // A slow track acknowledgement is not a dead subscription. Retry
            // the latest payload on the SAME channel; let the SDK rejoin first.
            if (subscribedRef.current) publishNow();
            else setPresenceRevision((value) => value + 1);
          },
          transport
            ? 30000
            : Math.min(30000, 2000 * 2 ** Math.min(presenceFailuresRef.current++, 4)),
        );
      };
      const recovered = () => {
        if (disposed || channelRef.current !== channel) return;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
        presenceFailuresRef.current = 0;
      };
      retryPresenceRef.current = retry;
      presenceRecoveredRef.current = recovered;

      const sync = () => {
        if (channelRef.current !== channel) return;
        const next = view.read(channel.presenceState<VoicePresenceMeta>());
        for (const [roomId, entries] of Object.entries(next)) {
          // Never resurrect this tab's old slot while its untrack is in flight.
          next[roomId] = entries.filter(
            (entry) =>
              !(
                entry.user_id === userId &&
                entry.voice_session_id === sessionIdRef.current &&
                !stateRef.current.activeChannelId
              ),
          );
        }
        // Presence round-trips must never make the local participant blink out.
        // The local lifecycle remains authoritative until leave() clears it.
        const local = stateRef.current;
        if (local.activeChannelId) {
          const room = next[local.activeChannelId] ?? [];
          next[local.activeChannelId] = [
            ...room.filter((participant) => participant.user_id !== userId),
            {
              user_id: userId,
              voice_session_id: sessionIdRef.current,
              muted: local.muted,
              deafened: local.deafened,
              speaking: local.speaking,
              camera: local.cameraOn,
              screen: local.screenOn,
            },
          ];
        }
        setParticipants(next);
      };

      channelServerRef.current = presenceServerId;
      channelRef.current = channel;
      channel
        .on("broadcast", { event: "occupancy-refresh" }, () => publishNow())
        .on("presence", { event: "sync" }, sync)
        .subscribe((status) => {
          // A late CLOSED/TIMED_OUT callback from the previous server must not
          // disable publishing on the replacement subscription.
          if (disposed || channelRef.current !== channel) return;
          if (status === "SUBSCRIBED") {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = null;
            subscribedRef.current = true;
            lastPublishedRef.current = null;
            sync();
            void channel.send({ type: "broadcast", event: "occupancy-refresh", payload: {} });
            publishNow();
          } else {
            subscribedRef.current = false;
            if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) retry(channel, true);
          }
        });
      channelRef.current = channel;

      const releaseOnUnload = () => {
        void channel.untrack();
      };
      window.addEventListener("pagehide", releaseOnUnload);
      // Restore an occupancy entry lost during a temporary signaling interruption.
      const heartbeat = setInterval(() => {
        // WebSocket already has a transport heartbeat. Repair an actually
        // missing occupancy slot, rather than retracking every idle user.
        const room = stateRef.current.activeChannelId;
        if (room && subscribedRef.current) {
          const entries = Object.values(channel.presenceState<VoicePresenceMeta>()).flat();
          if (
            !entries.some(
              (entry) =>
                entry.user_id === userId &&
                entry.voice_session_id === sessionIdRef.current &&
                entry.channel_id === room,
            )
          )
            lastPublishedRef.current = null;
        }
        publishNow();
      }, 15000);
      const occupancySweep = setInterval(sync, 2000);
      const restorePresence = () => publishNow();
      window.addEventListener("pageshow", restorePresence);
      window.addEventListener("online", restorePresence);

      return () => {
        disposed = true;
        if (retryTimer) clearTimeout(retryTimer);
        if (retryPresenceRef.current === retry) retryPresenceRef.current = null;
        if (presenceRecoveredRef.current === recovered) presenceRecoveredRef.current = null;
        clearInterval(heartbeat);
        clearInterval(occupancySweep);
        window.removeEventListener("pageshow", restorePresence);
        window.removeEventListener("online", restorePresence);
        window.removeEventListener("pagehide", releaseOnUnload);
        if (channelRef.current === channel) {
          channelRef.current = null;
          subscribedRef.current = false;
        }
        return releasePresence(channel);
      };
    });
  }, [presenceServerId, userId, publishNow, presenceRevision]);

  // Browsing another server observes its rooms without moving our call.
  useEffect(() => {
    if (!serverId || serverId === presenceServerId || !userId) {
      setObservedParticipants({});
      return;
    }
    // A replacement subscription should retain this server's recovery view,
    // rather than blanking its sidebar while channel removal is pending.
    setObservedParticipants(occupancyViewsRef.current.get(serverId)?.read({}) ?? {});
    return ownPresenceTopic(`voice:${serverId}`, () => {
      const view = occupancyViewsRef.current.get(serverId) ?? occupancyView();
      occupancyViewsRef.current.set(serverId, view);
      let disposed = false;
      const channel = supabase.channel(`voice:${serverId}`, {
        config: { presence: { key: `${userId}:${sessionIdRef.current}:observer`, enabled: true } },
      });
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let subscribed = false;
      let announced = false;
      let announcing = false;
      const retry = () => {
        if (disposed || retryTimer) return;
        retryTimer = setTimeout(
          () => {
            retryTimer = null;
            if (disposed) return;
            if (subscribed) void announce();
            else setObserverRevision((value) => value + 1);
          },
          Math.min(30000, 10000 * 2 ** Math.min(observerFailuresRef.current++, 2)),
        );
      };
      const announce = async () => {
        if (disposed || !subscribed || announced || announcing) return;
        announcing = true;
        try {
          const result = await channel.track(
            { user_id: userId, channel_id: null, updated_at: Date.now() },
            { timeout: 10000 },
          );
          if (disposed) return;
          if (result === "ok") {
            announced = true;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = null;
            observerFailuresRef.current = 0;
          } else retry();
        } catch {
          retry();
        } finally {
          announcing = false;
        }
      };
      const sync = () => {
        if (!disposed)
          setObservedParticipants(view.read(channel.presenceState<VoicePresenceMeta>()));
      };
      channel
        .on("presence", { event: "sync" }, () => {
          sync();
        })
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            subscribed = true;
            announced = false;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = null;
            void announce();
            void channel.send({ type: "broadcast", event: "occupancy-refresh", payload: {} });
          } else if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
            subscribed = false;
            retry();
          }
        });
      const heartbeat = setInterval(() => {
        void announce();
      }, 15000);
      const occupancySweep = setInterval(sync, 2000);
      return () => {
        disposed = true;
        clearInterval(heartbeat);
        clearInterval(occupancySweep);
        if (retryTimer) clearTimeout(retryTimer);
        return releasePresence(channel);
      };
    });
  }, [serverId, presenceServerId, userId, observerRevision]);

  // Call state changes publish at once. Speaking is detected from incoming
  // audio instead of tracking each speech burst, which floods the realtime
  // socket and gets the whole presence entry dropped mid-call.
  useEffect(() => {
    schedulePublish(true);
  }, [schedulePublish, activeChannelId, muted, deafened, cameraOn, screenOn]);

  // Speaking indicators in the active call come from incoming audio analysis,
  // without publishing microphone activity as Presence updates.

  useEffect(
    () => () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    },
    [],
  );

  // Keep the WebRTC mesh in sync with who is present in the active room.
  const roomPeers = activeChannelId ? (participantsByChannel[activeChannelId] ?? []) : [];
  const peerKey = roomPeers
    .map((p) => p.user_id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!activeChannelId) return;
    providerRef.current?.syncPeers(peerKey ? peerKey.split(",") : []);
  }, [peerKey, activeChannelId]);

  const detachCurrent = useCallback(() => {
    const provider = providerRef.current;
    providerRef.current = null;
    stateRef.current = {
      ...stateRef.current,
      activeChannelId: null,
      speaking: false,
      cameraOn: false,
      screenOn: false,
    };
    schedulePublish(true);
    setActiveChannelId(null);
    setSpeaking(false);
    setRemoteSpeaking({});
    setCameraOn(false);
    setScreenOn(false);
    setLocalCamera(null);
    setLocalScreen(null);
    setRemoteMedia({});
    setConnectionState("disconnected");
    setParticipants((current) => {
      if (!userId) return current;
      const next: Record<string, VoiceParticipant[]> = {};
      for (const [channelId, participants] of Object.entries(current)) {
        const remaining = participants.filter((participant) => participant.user_id !== userId);
        if (remaining.length > 0) next[channelId] = remaining;
      }
      return next;
    });
    return provider?.disconnect() ?? Promise.resolve();
  }, [schedulePublish, userId]);

  const leave = useCallback(() => {
    // Invalidate callbacks immediately. The queued teardown then removes the
    // exact current presence slot before another session is allowed to start.
    lifecycleGenerationRef.current += 1;
    pendingJoinChannelRef.current = null;
    const teardown = `voice-teardown-${lifecycleGenerationRef.current}`;
    reportDesktopCall(teardown, true);
    const disconnecting = detachCurrent();
    voiceServerRef.current = null;
    setActiveServerId(null);
    lifecycleQueueRef.current = lifecycleQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await disconnecting;
      })
      .finally(() => clearDesktopCall(teardown));
    return lifecycleQueueRef.current;
  }, [detachCurrent]);

  const join = useCallback(
    (channelId: string, callServerId = serverId, listenOnly = false) => {
      if (!userId || !callServerId) return Promise.resolve();
      if (
        pendingJoinChannelRef.current === channelId ||
        (stateRef.current.activeChannelId === channelId && providerRef.current)
      )
        return lifecycleQueueRef.current;
      const generation = lifecycleGenerationRef.current + 1;
      const transition = `voice-transition-${generation}`;
      beginDesktopCall(transition);
      pendingJoinChannelRef.current = channelId;
      lifecycleGenerationRef.current = generation;
      const disconnecting = detachCurrent();

      // Show the requested room immediately; socket acknowledgements are not
      // authoritative for the local participant's position during a move.
      sessionIdRef.current = crypto.randomUUID();
      sessionStartedAtRef.current = Date.now();
      voiceServerRef.current = callServerId;
      setActiveServerId(callServerId);
      if (listenOnly) setMuted(true);
      stateRef.current = {
        ...stateRef.current,
        activeChannelId: channelId,
        muted: listenOnly || stateRef.current.muted,
        speaking: false,
        cameraOn: false,
        screenOn: false,
      };
      setConnectionState("connecting");
      setActiveChannelId(channelId);
      schedulePublish(true);

      lifecycleQueueRef.current = lifecycleQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await disconnecting;
          if (generation !== lifecycleGenerationRef.current) return;

          const provider = createVoiceProvider();
          providerRef.current = provider;
          const isCurrent = () =>
            generation === lifecycleGenerationRef.current && providerRef.current === provider;

          try {
            // Read the server restriction before publishing the microphone, including on rejoin.
            const { data: restriction, error: restrictionError } = await supabase
              .from("voice_restrictions")
              .select("*")
              .eq("server_id", callServerId)
              .eq("user_id", userId)
              .maybeSingle();
            if (restrictionError) throw restrictionError;
            if (generation !== lifecycleGenerationRef.current) return;
            const nextRestrictions = { ...restrictionRef.current };
            if (restriction) nextRestrictions[`${callServerId}:${userId}`] = restriction;
            else delete nextRestrictions[`${callServerId}:${userId}`];
            restrictionRef.current = nextRestrictions;
            setRestrictions(nextRestrictions);
            stateRef.current.muted =
              listenOnly || localMuted || Boolean(restriction?.muted || restriction?.deafened);
            stateRef.current.deafened = localDeafened || Boolean(restriction?.deafened);
            provider.setMuted(stateRef.current.muted);
            provider.setDeafened(stateRef.current.deafened);
            await provider.setNoiseSuppression(audioSettings.noiseSuppression);
            await provider.connect(channelId, userId, {
              onNoiseProcessingChange: (status) => {
                if (isCurrent()) reportNoiseProcessing("voice", status);
              },
              onStateChange: (state) => {
                if (isCurrent()) setConnectionState(state);
              },
              onSpeakingChange: (value) => {
                if (isCurrent()) setSpeaking(value);
              },
              onRemoteSpeakingChange: (value) => {
                if (isCurrent()) setRemoteSpeaking(value);
              },
              onRemoteMedia: (media) => {
                if (isCurrent()) setRemoteMedia(media);
              },
              onLocalMedia: ({ camera, screen }) => {
                if (!isCurrent()) return;
                setLocalCamera(camera);
                setLocalScreen(screen);
                setCameraOn(!!camera);
                setScreenOn(!!screen);
              },
              onScreenShareEnded: () => {
                if (isCurrent()) setScreenOn(false);
              },
              onError: () => {
                if (!isCurrent()) return;
                setMicPermission("denied");
                toast.error("Não foi possível acessar o microfone.");
              },
            });
            if (!isCurrent()) {
              await provider.disconnect();
              return;
            }
            setMicPermission("granted");
            if (audioSettings.inputDeviceId)
              await provider
                .setDevices({ microphoneId: audioSettings.inputDeviceId })
                .catch(() => undefined);
            if (!isCurrent()) return;
            provider.setInputGain(audioSettings.inputVolume);
            provider.setMuted(stateRef.current.muted);
            provider.setDeafened(stateRef.current.deafened);
            void refreshDevices();
          } catch {
            await provider.disconnect().catch(() => undefined);
            if (!isCurrent()) return;
            providerRef.current = null;
            stateRef.current = { ...stateRef.current, activeChannelId: null };
            voiceServerRef.current = null;
            setActiveServerId(null);
            setActiveChannelId(null);
            schedulePublish(true);
            setConnectionState("error");
          }
        });
      lifecycleQueueRef.current = lifecycleQueueRef.current.finally(() => {
        if (generation === lifecycleGenerationRef.current) pendingJoinChannelRef.current = null;
        clearDesktopCall(transition);
      });
      return lifecycleQueueRef.current;
    },
    [
      detachCurrent,
      serverId,
      userId,
      refreshDevices,
      schedulePublish,
      localMuted,
      localDeafened,
      audioSettings.inputDeviceId,
      audioSettings.inputVolume,
      audioSettings.noiseSuppression,
      reportNoiseProcessing,
    ],
  );

  const moderationLeaveRef = useRef(leave);
  moderationLeaveRef.current = leave;
  const moveJoinRef = useRef(join);
  moveJoinRef.current = join;
  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    const seen = new Set<string>();
    const receive = (request: VoiceMoveRequest) => {
      if (
        disposed ||
        seen.has(request.id) ||
        !shouldApplyVoiceMove(
          request,
          userId,
          voiceServerRef.current,
          stateRef.current.activeChannelId,
          sessionIdRef.current,
          Date.now(),
          sessionStartedAtRef.current,
        )
      )
        return;
      seen.add(request.id);
      if (seen.size > 200) seen.delete(seen.values().next().value!);
      if (request.action === "disconnect") {
        void moderationLeaveRef
          .current()
          .then(() => toast.info("Você foi desconectado por um administrador."));
        return;
      }
      if (!request.destination_channel_id) return;
      void moveJoinRef
        .current(request.destination_channel_id, request.server_id)
        .catch(() => toast.error("Não foi possível mudar de canal de voz."));
    };
    let loading = false;
    const recover = async () => {
      if (disposed || loading || !stateRef.current.activeChannelId) return;
      loading = true;
      try {
        const { data } = await supabase
          .from("voice_move_requests")
          .select("*")
          .eq("recipient_id", userId)
          .gte("created_at", new Date(Date.now() - 15000).toISOString())
          .order("created_at", { ascending: true });
        if (!disposed) for (const row of data ?? []) receive(row);
      } catch {
        // Keep the call running; the next recovery pass retries after a network failure.
      } finally {
        loading = false;
      }
    };
    const channel = supabase
      .channel(`voice-moves:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "voice_move_requests",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => receive(payload.new as VoiceMoveRequest),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void recover();
      });
    // Realtime is the immediate path; this recovers missed events without user intervention.
    const recoveryTimer = setInterval(() => {
      void recover();
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(recoveryTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const toggleMute = useCallback(() => {
    const restriction = userId
      ? restrictionRef.current[`${voiceServerRef.current ?? serverId}:${userId}`]
      : undefined;
    if (restriction?.muted || restriction?.deafened) {
      toast.info("Seu microfone foi silenciado por um administrador.");
      return;
    }
    setMuted((prev) => {
      const next = !prev;
      providerRef.current?.setMuted(next);
      if (!next) setDeafened(false);
      return next;
    });
  }, [userId, serverId]);

  const toggleDeafen = useCallback(() => {
    if (
      userId &&
      restrictionRef.current[`${voiceServerRef.current ?? serverId}:${userId}`]?.deafened
    ) {
      toast.info("Seu áudio foi silenciado por um administrador.");
      return;
    }
    setDeafened((prev) => {
      const next = !prev;
      providerRef.current?.setDeafened(next);
      if (next) {
        setMuted(true);
        providerRef.current?.setMuted(true);
      }
      return next;
    });
  }, [userId, serverId]);

  const toggleCamera = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    if (stateRef.current.cameraOn) {
      provider.disableCamera();
      setCameraOn(false);
      return;
    }
    try {
      await provider.enableCamera(cameraDeviceId);
      setCameraPermission("granted");
      setCameraOn(true);
      void refreshDevices();
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraPermission("denied");
        toast.error("Permissão de câmera negada.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraPermission("unavailable");
        toast.error("Nenhuma câmera disponível.");
      } else {
        toast.error("Não foi possível iniciar a câmera.");
      }
    }
  }, [refreshDevices, cameraDeviceId]);

  const toggleScreenShare = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    if (stateRef.current.screenOn) {
      provider.stopScreenShare();
      setScreenOn(false);
      return;
    }
    try {
      await provider.startScreenShare();
      if (!provider.screenShareHasAudio)
        toast.info(
          "Tela compartilhada sem áudio. Para transmitir som, habilite o áudio da aba ou do sistema na seleção, quando disponível.",
        );
      // onLocalMedia is authoritative, including a capture stopped during startup.
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === "NotAllowedError") toast.info("Compartilhamento de tela cancelado.");
      else toast.error("Compartilhamento de tela indisponível neste dispositivo.");
    }
  }, []);

  const selectDevice = useCallback(
    async (kind: "microphoneId" | "cameraId" | "outputId", deviceId: string) => {
      if (kind === "outputId") {
        updateAudioSettings({ outputDeviceId: deviceId });
        return;
      }
      if (kind === "microphoneId") updateAudioSettings({ inputDeviceId: deviceId });
      else {
        setCameraDeviceId(deviceId);
        try {
          localStorage.setItem(DEVICE_KEY, JSON.stringify({ cameraId: deviceId }));
        } catch {
          /* storage unavailable */
        }
      }
      try {
        await providerRef.current?.setDevices({ [kind]: deviceId } as DeviceIds);
      } catch {
        toast.error("Não foi possível trocar o dispositivo.");
      }
    },
    [updateAudioSettings],
  );

  const setUserVolume = useCallback((targetId: string, volume: number) => {
    setVolumes((prev) => {
      const next = { ...prev, [targetId]: volume };
      try {
        localStorage.setItem(VOLUME_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
    providerRef.current?.setUserVolume(targetId, volume);
  }, []);

  // Live-apply persisted audio preferences to an active connection.
  useEffect(() => {
    providerRef.current?.setInputGain(audioSettings.inputVolume);
  }, [audioSettings.inputVolume, activeChannelId]);

  useEffect(() => {
    void providerRef.current
      ?.setNoiseSuppression(audioSettings.noiseSuppression)
      .catch(() => toast.error("Não foi possível alterar a supressão de ruídos."));
  }, [audioSettings.noiseSuppression, activeChannelId]);

  useEffect(() => {
    if (!activeChannelId) return;
    void providerRef.current
      ?.setDevices({ microphoneId: audioSettings.inputDeviceId })
      .catch(() => undefined);
  }, [audioSettings.inputDeviceId, activeChannelId]);

  // Push-to-talk: the key gates transmission without touching the manual mute.
  useEffect(() => {
    if (audioSettings.inputMode !== "ptt") {
      setPttHeld(false);
      return;
    }
    const down = (event: KeyboardEvent) => {
      if (event.code !== audioSettings.pttKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      setPttHeld(true);
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === audioSettings.pttKey) setPttHeld(false);
    };
    const blur = () => setPttHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [audioSettings.inputMode, audioSettings.pttKey]);

  const pttActive = audioSettings.inputMode === "open" || pttHeld;

  useEffect(() => {
    providerRef.current?.setMuted(muted || !pttActive);
    providerRef.current?.setDeafened(deafened);
  }, [muted, deafened, pttActive, activeChannelId]);

  useEffect(
    () => () => {
      lifecycleGenerationRef.current += 1;
      const provider = providerRef.current;
      providerRef.current = null;
      void provider?.disconnect();
    },
    [],
  );

  // Media and occupancy use different sockets. A live media track is evidence
  // that a peer is still in our room while occupancy is being resynchronized.
  const displayedParticipants = useMemo(() => {
    if (!activeChannelId) return participantsByChannel;
    const room = (participantsByChannel[activeChannelId] ?? []).map((participant) => ({
      ...participant,
      speaking: remoteSpeaking[participant.user_id] ?? participant.speaking,
      screen: remoteMedia[participant.user_id]
        ? Boolean(remoteMedia[participant.user_id]?.screen)
        : Boolean(participant.screen),
    }));
    const self = room.find((participant) => participant.user_id === userId);
    // Presence sync is asynchronous and may not emit after a quick re-entry.
    // The active local session is authoritative even before its next sync.
    if (userId) {
      const local = {
        user_id: userId,
        voice_session_id: sessionIdRef.current,
        muted: muted || !pttActive,
        deafened,
        speaking: speaking && !muted && pttActive,
        camera: cameraOn,
        screen: screenOn,
      };
      if (self) room[room.indexOf(self)] = local;
      else room.push(local);
    }
    for (const [id, media] of Object.entries(remoteMedia)) {
      if (room.some((participant) => participant.user_id === id)) continue;
      const live = [media.audio, media.camera, media.screen].some((stream) =>
        stream?.getTracks().some((track) => track.readyState === "live"),
      );
      if (live)
        room.push({
          user_id: id,
          muted: false,
          deafened: false,
          speaking: remoteSpeaking[id] ?? false,
          camera: Boolean(media.camera),
          screen: Boolean(media.screen),
        });
    }
    const rooms = Object.fromEntries(
      Object.entries(participantsByChannel).map(([id, participants]) => [
        id,
        participants.filter((participant) => participant.user_id !== userId),
      ]),
    );
    return { ...rooms, [activeChannelId]: room };
  }, [
    participantsByChannel,
    activeChannelId,
    remoteMedia,
    remoteSpeaking,
    userId,
    speaking,
    muted,
    deafened,
    cameraOn,
    screenOn,
    pttActive,
  ]);

  // Presence metadata updates may reorder snapshot keys. Keep the visible
  // channel order by identity, even when local/media recovery appends a peer.
  const orderedParticipants = useMemo(() => {
    const incoming = { ...observedParticipants, ...displayedParticipants };
    const nextOrder: Record<string, string[]> = {};
    const result: Record<string, VoiceParticipant[]> = {};
    for (const [channelId, participants] of Object.entries(incoming)) {
      const remaining = new Map(
        participants.map((participant) => [participant.user_id, participant]),
      );
      const ordered: VoiceParticipant[] = [];
      for (const id of participantOrderRef.current[channelId] ?? []) {
        const participant = remaining.get(id);
        if (!participant) continue;
        ordered.push(participant);
        remaining.delete(id);
      }
      ordered.push(...remaining.values());
      nextOrder[channelId] = ordered.map((participant) => participant.user_id);
      result[channelId] = ordered;
    }
    participantOrderRef.current = nextOrder;
    return result;
  }, [observedParticipants, displayedParticipants]);

  const value = useMemo<VoiceContextValue>(
    () => ({
      connectionState,
      activeChannelId,
      activeServerId,
      participantsByChannel: orderedParticipants,
      muted,
      deafened,
      cameraOn,
      screenOn,
      restrictions,
      transmitsAudio: true,
      volumes,
      hiddenVideos,
      setVideoHidden,
      remoteMedia,
      localCamera,
      localScreen,
      cameraPermission,
      micPermission,
      devices,
      selectedDevices: {
        microphoneId: audioSettings.inputDeviceId ?? undefined,
        cameraId: cameraDeviceId,
        outputId: audioSettings.outputDeviceId ?? undefined,
      },
      pttActive,
      join,
      leave,
      toggleMute,
      toggleDeafen,
      toggleCamera,
      toggleScreenShare,
      refreshDevices,
      selectDevice,
      setUserVolume,
    }),
    [
      restrictions,
      connectionState,
      activeChannelId,
      orderedParticipants,
      activeServerId,
      muted,
      deafened,
      cameraOn,
      screenOn,
      volumes,
      hiddenVideos,
      setVideoHidden,
      remoteMedia,
      localCamera,
      localScreen,
      cameraPermission,
      micPermission,
      devices,
      audioSettings.inputDeviceId,
      audioSettings.outputDeviceId,
      cameraDeviceId,

      pttActive,
      join,
      leave,
      toggleMute,
      toggleDeafen,
      toggleCamera,
      toggleScreenShare,
      refreshDevices,
      selectDevice,
      setUserVolume,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used inside <VoiceProviderRoot>");
  return ctx;
}

export function useOptionalVoice() {
  return useContext(VoiceContext);
}
