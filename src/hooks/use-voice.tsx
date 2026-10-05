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
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const presenceServerId = activeServerId ?? serverId;
  const voiceServerRef = useRef<string | null>(null);
  const channelServerRef = useRef<string | null>(null);
  const [observedParticipants, setObservedParticipants] = useState<
    Record<string, VoiceParticipant[]>
  >({});
  const [participantsByChannel, setParticipants] = useState<Record<string, VoiceParticipant[]>>({});
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
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
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishQueueRef = useRef<Promise<void>>(Promise.resolve());
  const sessionIdRef = useRef(crypto.randomUUID());
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
        if (!snapshot.activeChannelId) {
          await channel.untrack();
          return;
        }
        if (voiceServerRef.current !== channelServerRef.current) return;
        await channel.track({
          user_id: userId,
          channel_id: snapshot.activeChannelId,
          muted: snapshot.muted,
          deafened: snapshot.deafened,
          speaking: snapshot.speaking,
          camera: snapshot.cameraOn,
          screen: snapshot.screenOn,
          voice_session_id: snapshot.voiceSessionId,
          updated_at: Date.now(),
        });
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
        }, 100);
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

    const channel = supabase.channel(`voice:${presenceServerId}`, {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      if (channelRef.current !== channel) return;
      const state = channel.presenceState<VoicePresenceMeta>();
      const next: Record<string, VoiceParticipant[]> = {};
      for (const entries of Object.values(state)) {
        // A user can briefly hold more than one meta (reconnect, second tab);
        // the newest one wins so a stale socket never dictates the room.
        const entry = entries.reduce<(typeof entries)[number] | undefined>(
          (newest, candidate) =>
            !newest || (candidate.updated_at ?? 0) > (newest.updated_at ?? 0) ? candidate : newest,
          undefined,
        );
        if (!entry?.channel_id) continue;
        // Never resurrect this tab's old slot while its untrack is in flight.
        if (
          entry.user_id === userId &&
          entry.voice_session_id === sessionIdRef.current &&
          !stateRef.current.activeChannelId
        )
          continue;
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
      // Presence round-trips must never make the local participant blink out.
      // The local lifecycle remains authoritative until leave() clears it.
      const local = stateRef.current;
      if (local.activeChannelId) {
        const room = next[local.activeChannelId] ?? [];
        next[local.activeChannelId] = [
          ...room.filter((participant) => participant.user_id !== userId),
          {
            user_id: userId,
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
    channel.on("presence", { event: "sync" }, sync).subscribe((status) => {
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
    // Restore an occupancy entry lost during a temporary signaling interruption.
    const heartbeat = setInterval(publishNow, 15000);
    const restorePresence = () => publishNow();
    window.addEventListener("pageshow", restorePresence);
    window.addEventListener("online", restorePresence);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pageshow", restorePresence);
      window.removeEventListener("online", restorePresence);
      window.removeEventListener("pagehide", releaseOnUnload);
      if (channelRef.current === channel) {
        channelRef.current = null;
        subscribedRef.current = false;
      }
      void channel.untrack().finally(() => supabase.removeChannel(channel));
    };
  }, [presenceServerId, userId, publishNow]);

  // Browsing another server observes its rooms without moving our call.
  useEffect(() => {
    setObservedParticipants({});
    if (!serverId || serverId === presenceServerId || !userId) return;
    let disposed = false;
    const channel = supabase.channel(`voice:${serverId}`, {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        if (disposed) return;
        const next: Record<string, VoiceParticipant[]> = {};
        for (const entries of Object.values(channel.presenceState<VoicePresenceMeta>())) {
          const entry = entries.reduce<VoicePresenceMeta | undefined>(
            (latest, item) =>
              !latest || (item.updated_at ?? 0) > (latest.updated_at ?? 0) ? item : latest,
            undefined,
          );
          if (entry?.channel_id) (next[entry.channel_id] ??= []).push(entry);
        }
        setObservedParticipants(next);
      })
      .subscribe();
    return () => {
      disposed = true;
      void supabase.removeChannel(channel);
    };
  }, [serverId, presenceServerId, userId]);

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
    const teardown = `voice-teardown-${lifecycleGenerationRef.current}`;
    reportDesktopCall(teardown, true);
    const disconnecting = detachCurrent();
    voiceServerRef.current = null;
    setActiveServerId(null);
    lifecycleQueueRef.current = lifecycleQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await disconnecting;
        await publishQueueRef.current;
      })
      .finally(() => clearDesktopCall(teardown));
    return lifecycleQueueRef.current;
  }, [detachCurrent]);

  const join = useCallback(
    (channelId: string) => {
      if (!userId || !serverId) return Promise.resolve();
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

      lifecycleQueueRef.current = lifecycleQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          await disconnecting;
          await publishQueueRef.current;
          if (generation !== lifecycleGenerationRef.current) return;

          // Every entry is a distinct voice session. Presence from a previous
          // entry can no longer be mistaken for, or clean up, this one.
          sessionIdRef.current = crypto.randomUUID();
          voiceServerRef.current = serverId;
          setActiveServerId(serverId);
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
          } finally {
            if (pendingJoinChannelRef.current === channelId) pendingJoinChannelRef.current = null;
          }
        });
      lifecycleQueueRef.current = lifecycleQueueRef.current.finally(() =>
        clearDesktopCall(transition),
      );
      return lifecycleQueueRef.current;
    },
    [
      detachCurrent,
      serverId,
      userId,
      refreshDevices,
      schedulePublish,
      audioSettings.inputDeviceId,
      audioSettings.inputVolume,
      audioSettings.noiseSuppression,
      reportNoiseProcessing,
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
      if (!provider.screenShareHasAudio)
        toast.info(
          "Tela compartilhada sem áudio. Para transmitir som, habilite o áudio da aba ou do sistema na seleção, quando disponível.",
        );
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

  // Media and occupancy use different sockets. A live media track is evidence
  // that a peer is still in our room while occupancy is being resynchronized.
  const displayedParticipants = useMemo(() => {
    if (!activeChannelId) return participantsByChannel;
    const room = (participantsByChannel[activeChannelId] ?? []).map((participant) => ({
      ...participant,
      speaking: remoteSpeaking[participant.user_id] ?? participant.speaking,
    }));
    const self = room.find((participant) => participant.user_id === userId);
    // Presence sync is asynchronous and may not emit after a quick re-entry.
    // The active local session is authoritative even before its next sync.
    if (userId) {
      const local = {
        user_id: userId,
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
    return { ...participantsByChannel, [activeChannelId]: room };
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

  const value = useMemo<VoiceContextValue>(
    () => ({
      connectionState,
      activeChannelId,
      activeServerId,
      participantsByChannel: { ...observedParticipants, ...displayedParticipants },
      muted,
      deafened,
      cameraOn,
      screenOn,
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
      connectionState,
      activeChannelId,
      participantsByChannel,
      displayedParticipants,
      activeServerId,
      observedParticipants,
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
