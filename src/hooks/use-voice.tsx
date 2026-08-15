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

import { supabase } from "@/integrations/supabase/client";
import { createVoiceProvider, type VoiceProvider } from "@/services/voice";
import type { VoiceConnectionState, VoiceParticipant } from "@/types";

interface VoiceContextValue {
  connectionState: VoiceConnectionState;
  activeChannelId: string | null;
  /** channel_id -> participants, for the whole server (sidebar rendering). */
  participantsByChannel: Record<string, VoiceParticipant[]>;
  muted: boolean;
  deafened: boolean;
  transmitsAudio: boolean;
  volumes: Record<string, number>;
  join: (channelId: string) => Promise<void>;
  leave: () => Promise<void>;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setUserVolume: (userId: string, volume: number) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);
const VOLUME_KEY = "securechat:voice-volumes";

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
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  const providerRef = useRef<VoiceProvider | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef({ activeChannelId, muted, deafened, speaking });
  stateRef.current = { activeChannelId, muted, deafened, speaking };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw) setVolumes(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* ignore corrupted local settings */
    }
  }, []);

  // One presence channel per server carries every voice room's occupancy.
  useEffect(() => {
    if (!serverId || !userId) {
      setParticipants({});
      return;
    }

    const channel = supabase.channel(`voice:${serverId}`, {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState<VoiceParticipant & { channel_id: string }>();
      const next: Record<string, VoiceParticipant[]> = {};
      for (const entries of Object.values(state)) {
        const entry = entries[0];
        if (!entry?.channel_id) continue;
        next[entry.channel_id] = [
          ...(next[entry.channel_id] ?? []),
          {
            user_id: entry.user_id,
            muted: entry.muted,
            deafened: entry.deafened,
            speaking: entry.speaking,
          },
        ];
      }
      setParticipants(next);
    };

    channel.on("presence", { event: "sync" }, sync).subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [serverId, userId]);

  const publish = useCallback(async () => {
    const channel = channelRef.current;
    const { activeChannelId: id, muted: m, deafened: d, speaking: s } = stateRef.current;
    if (!channel || !userId) return;
    if (!id) {
      await channel.untrack();
      return;
    }
    await channel.track({ user_id: userId, channel_id: id, muted: m, deafened: d, speaking: s });
  }, [userId]);

  useEffect(() => {
    void publish();
  }, [publish, activeChannelId, muted, deafened, speaking]);

  const leave = useCallback(async () => {
    await providerRef.current?.disconnect();
    providerRef.current = null;
    setActiveChannelId(null);
    setSpeaking(false);
    setConnectionState("disconnected");
    await channelRef.current?.untrack();
  }, []);

  const join = useCallback(
    async (channelId: string) => {
      if (stateRef.current.activeChannelId === channelId) return;
      await leave();
      const provider = createVoiceProvider();
      providerRef.current = provider;
      setConnectionState("connecting");
      setActiveChannelId(channelId);
      try {
        await provider.connect(channelId, {
          onStateChange: (state) => setConnectionState(state),
          onSpeakingChange: (value) => setSpeaking(value),
          onError: () => toast.error("Não foi possível acessar o microfone."),
        });
        provider.setMuted(stateRef.current.muted);
      } catch {
        providerRef.current = null;
        setActiveChannelId(null);
        setConnectionState("error");
      }
    },
    [leave],
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

  useEffect(() => () => void providerRef.current?.disconnect(), []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      connectionState,
      activeChannelId,
      participantsByChannel,
      muted,
      deafened,
      transmitsAudio: providerRef.current?.transmitsAudio ?? false,
      volumes,
      join,
      leave,
      toggleMute,
      toggleDeafen,
      setUserVolume,
    }),
    [
      connectionState,
      activeChannelId,
      participantsByChannel,
      muted,
      deafened,
      volumes,
      join,
      leave,
      toggleMute,
      toggleDeafen,
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
