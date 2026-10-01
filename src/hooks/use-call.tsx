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
import { createVoiceProvider, type RemoteMedia, type VoiceProvider } from "@/services/voice";
import { createCallGracePeriod } from "@/services/call-grace-period";
import type { Profile } from "@/types";

/**
 * 1:1 private calls (voice or video).
 *
 * Reuses the exact same WebRTC mesh provider used by server voice channels —
 * the only difference is the room id (`call-<callId>`) and the ring/accept
 * handshake, which travels over Supabase Realtime broadcast:
 *
 *   calls:user:<userId>   inbox — receives "ring" from anyone
 *   callsig:<callId>      per-call control channel (accept/decline/cancel/end/busy)
 */

export type CallStatus =
  "idle" | "outgoing" | "incoming" | "connecting" | "active" | "reconnecting" | "waiting" | "ended";

export type CallEndReason =
  "declined" | "cancelled" | "ended" | "busy" | "failed" | "unanswered" | null;

export interface CallPeer {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
}

interface CallContextValue {
  groupConversationId: string | null;
  participants: CallPeer[];
  groupMedia: Record<string, RemoteMedia>;
  startGroupCall: (id: string, name: string, members: CallPeer[]) => Promise<void>;
  status: CallStatus;
  endReason: CallEndReason;
  aloneDeadline: number | null;
  peer: CallPeer | null;
  video: boolean;
  muted: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  localCamera: MediaStream | null;
  localScreen: MediaStream | null;
  remote: RemoteMedia | null;
  /** user ids currently in a private call (presence-derived). */
  busyUsers: Record<string, true>;
  startCall: (peer: CallPeer, video: boolean) => Promise<void>;
  accept: (withVideo?: boolean) => Promise<void>;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  dismiss: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

const RING_TIMEOUT_MS = 45_000;

type Control = "accept" | "decline" | "cancel" | "end" | "busy";

interface RingPayload {
  callId: string;
  video: boolean;
  from: CallPeer;
}

export function CallProviderRoot({
  userId,
  profile,
  children,
}: {
  userId: string | undefined;
  profile: Profile | null | undefined;
  children: ReactNode;
}) {
  const { settings: audioSettings } = useAudioSettings();
  const audioRef = useRef(audioSettings);
  audioRef.current = audioSettings;
  const [status, setStatus] = useState<CallStatus>("idle");
  const [aloneDeadline, setAloneDeadline] = useState<number | null>(null);
  const graceRef = useRef<ReturnType<typeof createCallGracePeriod> | null>(null);
  const [endReason, setEndReason] = useState<CallEndReason>(null);
  const [peer, setPeer] = useState<CallPeer | null>(null);
  const [video, setVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localCamera, setLocalCamera] = useState<MediaStream | null>(null);
  const [localScreen, setLocalScreen] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<RemoteMedia | null>(null);
  const [busyUsers, setBusyUsers] = useState<Record<string, true>>({});
  const [groupConversationId, setGroupConversationId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<CallPeer[]>([]);
  const [groupMedia, setGroupMedia] = useState<Record<string, RemoteMedia>>({});
  const groupPresenceRef = useRef<RealtimeChannel | null>(null);

  const providerRef = useRef<VoiceProvider | null>(null);
  const controlRef = useRef<RealtimeChannel | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerRef = useRef<CallPeer | null>(null);
  const statusRef = useRef<CallStatus>("idle");
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceRef = useRef<RealtimeChannel | null>(null);

  statusRef.current = status;
  peerRef.current = peer;

  const me: CallPeer | null = useMemo(
    () =>
      profile
        ? {
            id: profile.id,
            display_name: profile.display_name,
            username: profile.username,
            avatar_url: profile.avatar_url ?? null,
          }
        : null,
    [profile],
  );

  /* --------------------------------------------------------------- cleanup */

  const teardownMedia = useCallback(async () => {
    const presence = groupPresenceRef.current;
    groupPresenceRef.current = null;
    const provider = providerRef.current;
    providerRef.current = null;
    setRemote(null);
    setLocalCamera(null);
    setLocalScreen(null);
    setCameraOn(false);
    setScreenOn(false);
    setMuted(false);
    setGroupConversationId(null);
    setParticipants([]);
    setGroupMedia({});
    await Promise.all([presence ? supabase.removeChannel(presence) : undefined, provider?.disconnect()]);
  }, []);

  const closeControl = useCallback(async (pending?: Promise<unknown>) => {
    const channel = controlRef.current;
    controlRef.current = null;
    if (pending) await pending.catch(() => undefined);
    if (channel) await supabase.removeChannel(channel);
  }, []);

  const finish = useCallback(
    async (reason: CallEndReason, pending?: Promise<unknown>) => {
      if (ringTimer.current) clearTimeout(ringTimer.current);
      ringTimer.current = null;
      graceRef.current?.cancel();
      setAloneDeadline(null);
      callIdRef.current = null;
      statusRef.current = reason ? "ended" : "idle";
      setEndReason(reason);
      setStatus(reason ? "ended" : "idle");
      if (reason) setTimeout(() => setStatus((s) => (s === "ended" ? "idle" : s)), 2600);
      await Promise.all([teardownMedia(), closeControl(pending)]);
    },
    [teardownMedia, closeControl],
  );

  const waitAfterPeerLeft = useCallback(() => {
    if (["waiting"].includes(statusRef.current)) return;
    if (!["active", "connecting", "reconnecting"].includes(statusRef.current)) {
      void finish(null);
      return;
    }
    statusRef.current = "waiting";
    setStatus("waiting");
    setRemote(null);
    providerRef.current?.syncPeers([]);
    if (!graceRef.current) graceRef.current = createCallGracePeriod(() => {
      if (["waiting"].includes(statusRef.current)) void finish(null);
    });
    setAloneDeadline(graceRef.current.start());
  }, [finish]);

  /* ------------------------------------------------------------ presence */

  const inCall = status === "active" || status === "connecting" || status === "reconnecting" || status === "waiting";

  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("calls:presence", {
      config: { presence: { key: userId } },
    });
    const sync = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const next: Record<string, true> = {};
      for (const entries of Object.values(state)) {
        const entry = entries[0];
        if (entry?.user_id) next[entry.user_id] = true;
      }
      setBusyUsers(next);
    };
    channel.on("presence", { event: "sync" }, sync).subscribe();
    presenceRef.current = channel;
    return () => {
      presenceRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    const channel = presenceRef.current;
    if (!channel || !userId) return;
    if (inCall) void channel.track({ user_id: userId });
    else void channel.untrack();
  }, [inCall, userId]);

  /* ------------------------------------------------------ media lifecycle */

  const startMedia = useCallback(
    async (callId: string, remoteId: string, withVideo: boolean) => {
      const provider = createVoiceProvider();
      providerRef.current = provider;
      statusRef.current = "connecting";
      setStatus("connecting");
      try {
        await provider.connect(`call-${callId}`, userId!, {
          onStateChange: (state) => {
            if (providerRef.current !== provider || ["waiting"].includes(statusRef.current)) return;
            if (state === "connected") setStatus("active");
            else if (state === "reconnecting") setStatus("reconnecting");
            else if (state === "connecting") setStatus("connecting");
          },
          onRemoteMedia: (media) => {
            if (providerRef.current === provider && statusRef.current !== "waiting") setRemote(media[remoteId] ?? null);
          },
          onLocalMedia: ({ camera, screen }) => {
            if (providerRef.current !== provider) return;
            setLocalCamera(camera);
            setLocalScreen(screen);
            setCameraOn(!!camera);
            setScreenOn(!!screen);
          },
          onScreenShareEnded: () => setScreenOn(false),
          onError: () => toast.error("Não foi possível acessar o microfone."),
        });
        if (providerRef.current !== provider) { await provider.disconnect(); return; }
        if (["waiting"].includes(statusRef.current)) return;
        if (audioRef.current.inputDeviceId)
          await provider
            .setDevices({ microphoneId: audioRef.current.inputDeviceId })
            .catch(() => undefined);
        if (providerRef.current !== provider || ["waiting"].includes(statusRef.current)) return;
        provider.setInputGain(audioRef.current.inputVolume);
        provider.syncPeers([remoteId]);
        if (withVideo) {
          try {
            await provider.enableCamera();
            setCameraOn(true);
          } catch {
            toast.error("Não foi possível iniciar a câmera.");
          }
        }
      } catch {
        if (providerRef.current !== provider || ["waiting"].includes(statusRef.current)) return;
        toast.error("Falha ao iniciar a chamada.");
        await finish("failed");
      }
    },
    [userId, finish],
  );

  /* ------------------------------------------------------------- control */

  const sendControl = useCallback((type: Control) => {
    return controlRef.current?.send({
      type: "broadcast",
      event: "control",
      payload: { type },
    });
  }, []);

  const openControl = useCallback(
    async (callId: string) => {
      await closeControl();
      const channel = supabase.channel(`callsig:${callId}`, {
        config: { broadcast: { self: false, ack: true } },
      });
      channel.on("broadcast", { event: "control" }, ({ payload }) => {
        if (callIdRef.current !== callId) return;
        const type = (payload as { type: Control }).type;
        if (type === "accept") {
          const remoteId = peerRef.current?.id;
          if (remoteId && statusRef.current === "outgoing") {
            if (ringTimer.current) clearTimeout(ringTimer.current);
            void startMedia(callId, remoteId, video);
          }
        } else if (type === "decline") void finish("declined");
        else if (type === "cancel") void finish("cancelled");
        else if (type === "busy") void finish("busy");
        else if (type === "end") waitAfterPeerLeft();
      });
      await new Promise<void>((resolve) => {
        channel.subscribe((state) => {
          if (state === "SUBSCRIBED") resolve();
        });
      });
      if (callIdRef.current !== callId) { await supabase.removeChannel(channel); return; }
      controlRef.current = channel;
    },
    [closeControl, finish, startMedia, video, waitAfterPeerLeft],
  );

  /* --------------------------------------------------------------- inbox */

  useEffect(() => {
    if (!userId) return;
    const inbox = supabase.channel(`calls:user:${userId}`, {
      config: { broadcast: { self: false, ack: false } },
    });

    inbox.on("broadcast", { event: "ring" }, ({ payload }) => {
      const ring = payload as RingPayload;
      if (statusRef.current !== "idle" && statusRef.current !== "ended") {
        // Already busy — tell the caller immediately.
        const temp = supabase.channel(`callsig:${ring.callId}`, {
          config: { broadcast: { self: false, ack: false } },
        });
        temp.subscribe((state) => {
          if (state !== "SUBSCRIBED") return;
          void temp
            .send({ type: "broadcast", event: "control", payload: { type: "busy" } })
            .then(() => supabase.removeChannel(temp));
        });
        return;
      }
      callIdRef.current = ring.callId;
      setPeer(ring.from);
      setVideo(ring.video);
      setEndReason(null);
      setStatus("incoming");
      void openControl(ring.callId);
      if (ringTimer.current) clearTimeout(ringTimer.current);
      ringTimer.current = setTimeout(() => void finish("unanswered"), RING_TIMEOUT_MS);
    });

    inbox.subscribe();
    return () => {
      void supabase.removeChannel(inbox);
    };
  }, [userId, openControl, finish]);

  /* -------------------------------------------------------------- actions */

  const startGroupCall = useCallback(
    async (id: string, name: string, members: CallPeer[]) => {
      if (!userId || !me || !members.some((member) => member.id === userId)) return;
      if (statusRef.current !== "idle" && statusRef.current !== "ended") return;
      statusRef.current = "connecting";
      setStatus("connecting");
      setEndReason(null);
      setGroupConversationId(id);
      setPeer({ id, display_name: name, username: "", avatar_url: null });
      setParticipants([me]);
      const provider = createVoiceProvider();
      providerRef.current = provider;
      const presence = supabase.channel(`group-call:${id}`, {
        config: { presence: { key: userId } },
      });
      groupPresenceRef.current = presence;
      const sync = () => {
        if (groupPresenceRef.current !== presence) return;
        const ids = new Set(
          Object.values(presence.presenceState<{ user_id: string }>())
            .flat()
            .map((entry) => entry.user_id),
        );
        ids.add(userId);
        const connected = members.filter((member) => ids.has(member.id));
        setParticipants(connected);
        provider.syncPeers(
          connected.filter((member) => member.id !== userId).map((member) => member.id),
        );
      };
      try {
        await provider.connect(`group-call-${id}`, userId, {
          onStateChange: (state) => {
            if (providerRef.current !== provider) return;
            if (state === "error") {
              void finish("failed");
              return;
            }
            setStatus(state === "connected" ? "active" : state);
          },
          onRemoteMedia: (media) => {
            if (providerRef.current === provider) setGroupMedia(media);
          },
          onLocalMedia: ({ camera, screen }) => {
            if (providerRef.current !== provider) return;
            setLocalCamera(camera);
            setLocalScreen(screen);
            setCameraOn(!!camera);
            setScreenOn(!!screen);
          },
          onScreenShareEnded: () => setScreenOn(false),
        });
        if (providerRef.current !== provider) {
          await provider.disconnect();
          return;
        }
        provider.setInputGain(audioRef.current.inputVolume);
        if (audioRef.current.inputDeviceId)
          await provider.setDevices({ microphoneId: audioRef.current.inputDeviceId });
        presence.on("presence", { event: "sync" }, sync).subscribe((state) => {
          if (groupPresenceRef.current !== presence) return;
          if (state === "SUBSCRIBED") void presence.track({ user_id: userId }).then(sync);
          else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") void finish("failed");
        });
      } catch {
        toast.error("Não foi possível entrar na chamada do grupo.");
        await finish("failed");
      }
    },
    [userId, me, finish],
  );

  const startCall = useCallback(
    async (target: CallPeer, withVideo: boolean) => {
      if (!userId || !me) return;
      if (statusRef.current !== "idle" && statusRef.current !== "ended") return;
      const callId = `${userId}-${target.id}-${Date.now().toString(36)}`;
      callIdRef.current = callId;
      setPeer(target);
      setVideo(withVideo);
      setEndReason(null);
      setStatus("outgoing");
      await openControl(callId);

      // Ring the callee's personal inbox.
      const inbox = supabase.channel(`calls:user:${target.id}`, {
        config: { broadcast: { self: false, ack: false } },
      });
      inbox.subscribe((state) => {
        if (state !== "SUBSCRIBED") return;
        void inbox
          .send({
            type: "broadcast",
            event: "ring",
            payload: { callId, video: withVideo, from: me } satisfies RingPayload,
          })
          .then(() => supabase.removeChannel(inbox));
      });

      if (ringTimer.current) clearTimeout(ringTimer.current);
      ringTimer.current = setTimeout(() => {
        sendControl("cancel");
        void finish("unanswered");
      }, RING_TIMEOUT_MS);
    },
    [userId, me, openControl, sendControl, finish],
  );

  const accept = useCallback(
    async (withVideo?: boolean) => {
      const callId = callIdRef.current;
      const remoteId = peerRef.current?.id;
      if (!callId || !remoteId) return;
      if (ringTimer.current) clearTimeout(ringTimer.current);
      const useVideo = withVideo ?? video;
      setVideo(useVideo);
      sendControl("accept");
      await startMedia(callId, remoteId, useVideo);
    },
    [sendControl, startMedia, video],
  );

  const decline = useCallback(() => {
    const pending = sendControl("decline");
    void finish("declined", pending);
  }, [sendControl, finish]);

  const hangUp = useCallback(() => {
    const pending = sendControl(statusRef.current === "outgoing" ? "cancel" : "end");
    void finish(null, pending);
  }, [sendControl, finish]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      providerRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const toggleCamera = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    if (cameraOn) {
      provider.disableCamera();
      setCameraOn(false);
      return;
    }
    try {
      await provider.enableCamera();
      setCameraOn(true);
    } catch {
      toast.error("Não foi possível iniciar a câmera.");
    }
  }, [cameraOn]);

  const toggleScreenShare = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return;
    if (screenOn) {
      provider.stopScreenShare();
      setScreenOn(false);
      return;
    }
    try {
      await provider.startScreenShare();
      setScreenOn(true);
    } catch (error) {
      if ((error as DOMException)?.name === "NotAllowedError")
        toast.info("Compartilhamento de tela cancelado.");
      else toast.error("Compartilhamento de tela indisponível.");
    }
  }, [screenOn]);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setEndReason(null);
  }, []);

  useEffect(
    () => () => {
      graceRef.current?.cancel();
      if (controlRef.current) void supabase.removeChannel(controlRef.current);
      if (ringTimer.current) clearTimeout(ringTimer.current);
      void providerRef.current?.disconnect();
      if (groupPresenceRef.current) void supabase.removeChannel(groupPresenceRef.current);
    },
    [],
  );

  const value = useMemo<CallContextValue>(
    () => ({
      groupConversationId,
      participants,
      groupMedia,
      startGroupCall,
      status,
      endReason,
      aloneDeadline,
      peer,
      video,
      muted,
      cameraOn,
      screenOn,
      localCamera,
      localScreen,
      remote,
      busyUsers,
      startCall,
      accept,
      decline,
      hangUp,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      dismiss,
    }),
    [
      groupConversationId,
      participants,
      groupMedia,
      startGroupCall,
      status,
      endReason,
      aloneDeadline,
      peer,
      video,
      muted,
      cameraOn,
      screenOn,
      localCamera,
      localScreen,
      remote,
      busyUsers,
      startCall,
      accept,
      decline,
      hangUp,
      toggleMute,
      toggleCamera,
      toggleScreenShare,
      dismiss,
    ],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used inside <CallProviderRoot>");
  return ctx;
}

/** Same as useCall but returns null outside the provider (safe in popovers). */
export function useOptionalCall() {
  return useContext(CallContext) ?? null;
}
