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

export type MediaPermission = "unknown" | "granted" | "denied" | "unavailable";

interface VoiceContextValue {
  connectionState: VoiceConnectionState;
  activeChannelId: string | null;
  /** channel_id -> participants, for the whole server (sidebar rendering). */
  participantsByChannel: Record<string, VoiceParticipant[]>;
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  transmitsAudio: boolean;
  volumes: Record<string, number>;
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
  join: (channelId: string) => Promise<void>;
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

type VoicePresenceMeta = VoiceParticipant & {
  channel_id: string;
  voice_session_id?: string;
  updated_at?: number;
};

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
  const [participantsByChannel, setParticipants] = useState<Record<string, VoiceParticipant[]>>({});
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
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
  } = useAudioSettings();
  const [pttHeld, setPttHeld] = useState(false);

  const providerRef = useRef<VoiceProvider | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionIdRef = useRef(crypto.randomUUID());
  const lifecycleQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lifecycleGenerationRef = useRef(0);
  const previousServerRef = useRef<string | null>(serverId);
  const stateRef = useRef({ activeChannelId, muted, deafened, speaking, cameraOn, screenOn });
  stateRef.current = { activeChannelId, muted, deafened, speaking, cameraOn, screenOn };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw) setVolumes(JSON.parse(raw) as Record<string, number>);
      const rawDevices = localStorage.getItem(DEVICE_KEY);
      if (rawDevices)
        setCameraDeviceId((JSON.parse(rawDevices) as { cameraId?: string }).cameraId);
    } catch {
      /* ignore corrupted local settings */
    }
  }, []);

  const refreshDevices = refreshSharedDevices;

  const publishNow = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current || !userId) return;

    const snapshot = { ...stateRef.current };
    publishQueueRef.current = publishQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        // The provider may have switched servers while this update waited.
        if (channelRef.current !== channel || !subscribedRef.current) return;
        if (!snapshot.activeChannelId) {
          await channel.untrack();
          return;
        }
        await channel.track({
          user_id: userId,
          channel_id: snapshot.activeChannelId,
          muted: snapshot.muted,
          deafened: snapshot.deafened,
          speaking: snapshot.speaking,
          camera: snapshot.cameraOn,
          screen: snapshot.screenOn,
          voice_session_id: sessionIdRef.current,
          updated_at: Date.now(),
        });
      });
  }, [userId]);

  const schedulePublish = useCallback(
    (immediate: boolean) => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
      publishTimer.current = null;
      if (immediate) publishNow();
      else publishTimer.current = setTimeout(publishNow, 250);
    },
    [publishNow],
  );

  // One presence channel per server carries every voice room's occupancy.
  // The presence payload is republished whenever the channel (re)subscribes,
  // so a socket reconnect restores our slot instead of silently dropping it.
  useEffect(() => {
    if (!serverId || !userId) {
      setParticipants({});
      return;
    }

    const channel = supabase.channel(`voice:${serverId}`, {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState<VoicePresenceMeta>();
      const next: Record<string, VoiceParticipant[]> = {};
      for (const entries of Object.values(state)) {
        // A user can briefly hold more than one meta (reconnect, second tab);
        // the newest one wins so a stale socket never dictates the room.
        const entry = entries.reduce<(typeof entries)[number] | undefined>(
          (newest, candidate) =>
            !newest || (candidate.updated_at ?? 0) > (newest.updated_at ?? 0)
              ? candidate
              : newest,
          undefined,
        );
        if (!entry?.channel_id) continue;
        next[entry.channel_id] = [
          ...(next[entry.channel_id] ?? []),
          {
            user_id: entry.user_id,
            muted: entry.muted,
            deafened: entry.deafened,
            speaking: entry.speaking,
            camera: entry.camera ?? false,
            screen: entry.screen ?? false,
          },
        ];
      }
      setParticipants(next);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        // A late CLOSED/TIMED_OUT callback from the previous server must not
        // disable publishing on the replacement subscription.
        if (channelRef.current !== channel) return;
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true;
          publishNow();
        } else {
          subscribedRef.current = false;
        }
      });
    channelRef.current = channel;

    const releaseOnUnload = () => {
      void channel.untrack();
    };
    window.addEventListener("pagehide", releaseOnUnload);

    return () => {
      window.removeEventListener("pagehide", releaseOnUnload);
      if (channelRef.current === channel) {
        channelRef.current = null;
        subscribedRef.current = false;
      }
      void supabase.removeChannel(channel);
    };
  }, [serverId, userId, publishNow]);

  // Every state change publishes at once; only the noisy `speaking` flag is
  // coalesced, because tracking on each speech burst floods the realtime
  // socket and gets the whole presence entry dropped mid-call.
  useEffect(() => {
    schedulePublish(true);
  }, [schedulePublish, activeChannelId, muted, deafened, cameraOn, screenOn]);

  useEffect(() => {
    schedulePublish(false);
  }, [schedulePublish, speaking]);

  useEffect(
    () => () => {
      if (publishTimer.current) clearTimeout(publishTimer.current);
    },
    [],
  );


  // Keep the WebRTC mesh in sync with who is present in the active room.
  const roomPeers = activeChannelId ? (participantsByChannel[activeChannelId] ?? []) : [];
  const peerKey = roomPeers.map((p) => p.user_id).sort().join(",");
  useEffect(() => {
    if (!activeChannelId) return;
    providerRef.current?.syncPeers(peerKey ? peerKey.split(",") : []);
  }, [peerKey, activeChannelId]);

  const leaveCurrent = useCallback(async () => {
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
    await provider?.disconnect();
    setActiveChannelId(null);
    setSpeaking(false);
    setCameraOn(false);
    setScreenOn(false);
    setLocalCamera(null);
    setLocalScreen(null);
    setRemoteMedia({});
    setConnectionState("disconnected");
    await publishQueueRef.current;
  }, [schedulePublish]);

  const leave = useCallback(() => {
    // Invalidate callbacks immediately. The queued teardown then removes the
    // exact current presence slot before another session is allowed to start.
    lifecycleGenerationRef.current += 1;
    lifecycleQueueRef.current = lifecycleQueueRef.current
      .catch(() => undefined)
      .then(leaveCurrent);
    return lifecycleQueueRef.current;
  }, [leaveCurrent]);

  // Switching servers owns the full voice lifecycle: leave the previous room
  // before the new server can publish or negotiate with its participants.
  useEffect(() => {
    const previous = previousServerRef.current;
    previousServerRef.current = serverId;
    if (previous && previous !== serverId && stateRef.current.activeChannelId) void leave();
  }, [serverId, leave]);

  const join = useCallback(
    (channelId: string) => {
      if (!userId) return Promise.resolve();
      const generation = lifecycleGenerationRef.current + 1;
      lifecycleGenerationRef.current = generation;

      lifecycleQueueRef.current = lifecycleQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (generation !== lifecycleGenerationRef.current) return;
          if (stateRef.current.activeChannelId === channelId && providerRef.current) return;

          await leaveCurrent();
          if (generation !== lifecycleGenerationRef.current) return;

          // Every entry is a distinct voice session. Presence from a previous
          // entry can no longer be mistaken for, or clean up, this one.
          sessionIdRef.current = crypto.randomUUID();
          stateRef.current = {
            ...stateRef.current,
            activeChannelId: channelId,
            speaking: false,
            cameraOn: false,
            screenOn: false,
          };
          setConnectionState("connecting");
          setActiveChannelId(channelId);
          schedulePublish(true);

          const provider = createVoiceProvider();
          providerRef.current = provider;
          const isCurrent = () =>
            generation === lifecycleGenerationRef.current && providerRef.current === provider;

          try {
            await provider.connect(channelId, userId, {
              onStateChange: (state) => {
                if (isCurrent()) setConnectionState(state);
              },
              onSpeakingChange: (value) => {
                if (isCurrent()) setSpeaking(value);
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
            void refreshDevices();
          } catch {
            await provider.disconnect().catch(() => undefined);
            if (!isCurrent()) return;
            providerRef.current = null;
            stateRef.current = { ...stateRef.current, activeChannelId: null };
            setActiveChannelId(null);
            schedulePublish(true);
            setConnectionState("error");
          }
        });
      return lifecycleQueueRef.current;
    },
    [
      leaveCurrent,
      userId,
      refreshDevices,
      schedulePublish,
      audioSettings.inputDeviceId,
      audioSettings.inputVolume,
    ],
  );

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      providerRef.current?.setMuted(next);
      if (!next) setDeafened(false);
      return next;
    });
  }, []);

  const toggleDeafen = useCallback(() => {
    setDeafened((prev) => {
      const next = !prev;
      providerRef.current?.setDeafened(next);
      if (next) {
        setMuted(true);
        providerRef.current?.setMuted(true);
      }
      return next;
    });
  }, []);

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
      setScreenOn(true);
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
    if (!activeChannelId || !audioSettings.inputDeviceId) return;
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
  }, [muted, pttActive, activeChannelId]);

  useEffect(
    () => () => {
      lifecycleGenerationRef.current += 1;
      const provider = providerRef.current;
      providerRef.current = null;
      void provider?.disconnect();
    },
    [],
  );

  const value = useMemo<VoiceContextValue>(
    () => ({
      connectionState,
      activeChannelId,
      participantsByChannel,
      muted,
      deafened,
      cameraOn,
      screenOn,
      transmitsAudio: true,
      volumes,
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
      connectionState,
      activeChannelId,
      participantsByChannel,
      muted,
      deafened,
      cameraOn,
      screenOn,
      volumes,
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
