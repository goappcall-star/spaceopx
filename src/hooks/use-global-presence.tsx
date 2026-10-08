import { maintainPresence } from "@/services/presence-connection";
import { readDetectedGames, type DetectedGame } from "@/services/desktop-activity";
import { useQueryClient } from "@tanstack/react-query";
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
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import type { UserStatus } from "@/types";
import { resolvePresence, type PresenceRow } from "@/services/presence";

export type SelectableStatus = Extract<UserStatus, "online" | "idle" | "dnd">;
export type ConnectionState = "connecting" | "online" | "reconnecting";
let presenceRelease: Promise<unknown> = Promise.resolve();
let stopPresence: (() => void) | null = null;
interface GlobalPresenceValue {
  statuses: Record<string, UserStatus>;
  games: Record<string, DetectedGame>;
  statusOf: (id: string | null | undefined) => UserStatus;
  isOnline: (id: string | null | undefined) => boolean;
  myStatus: UserStatus;
  setStatus: (status: SelectableStatus) => Promise<void>;
  connection: ConnectionState;
}
const GlobalPresenceContext = createContext<GlobalPresenceValue | undefined>(undefined);
export function GlobalPresenceProvider({
  userId,
  profileStatus,
  children,
}: {
  userId: string | undefined;
  profileStatus: UserStatus | undefined;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [games, setGames] = useState<Record<string, DetectedGame>>({});
  const gameRef = useRef<DetectedGame | null>(null);
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({});
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const statusRef = useRef<SelectableStatus>("online");
  const trackRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    statusRef.current = profileStatus && profileStatus !== "offline" ? profileStatus : "online";
    trackRef.current?.();
  }, [profileStatus, userId]);

  useEffect(() => {
    gameRef.current = null;
    if (!userId || !window.lobbyxDesktop) return;
    let disposed = false;
    let busy = false;
    const syncActivity = async () => {
      if (busy) return;
      busy = true;
      try {
        const state = await window.lobbyxDesktop!.activity();
        if (!disposed) {
          gameRef.current = state.enabled ? state.game : null;
          trackRef.current?.();
        }
      } catch {
        if (!disposed) {
          gameRef.current = null;
          trackRef.current?.();
        }
      } finally {
        busy = false;
      }
    };
    void syncActivity();
    const timer = setInterval(() => void syncActivity(), 10000);
    window.addEventListener("lobbyx:activity-changed", syncActivity);
    return () => {
      disposed = true;
      gameRef.current = null;
      clearInterval(timer);
      window.removeEventListener("lobbyx:activity-changed", syncActivity);
    };
  }, [userId]);

  useEffect(() => {
    setGames({});
    setStatuses({});
    setConnection("connecting");
    if (!userId) return;
    let disposed = false;
    let suspended = false;
    const connection = maintainPresence({
      create: () => supabase.channel("presence:global", { config: { presence: { key: userId } } }),
      remove: (channel) => supabase.removeChannel(channel),
      payload: () => ({
        user_id: userId,
        status: statusRef.current,
        at: Date.now(),
        game: gameRef.current,
      }),
      available: () => !suspended && navigator.onLine,
      connected: () => {
        if (!disposed) setConnection("online");
      },
      disconnected: () => {
        if (!disposed) {
          setConnection("reconnecting");
          setStatuses({});
          setGames({});
        }
      },
      sync: (channel) => {
        if (disposed) return;
        const state = channel.presenceState<PresenceRow & { game?: unknown }>();
        setStatuses(resolvePresence(state));
        setGames(readDetectedGames(state));
      },
    });
    const track = connection.track;
    trackRef.current = track;
    // A route remount must wait until the previous instance leaves this topic.
    void presenceRelease
      .catch(() => undefined)
      .then(() => (disposed ? undefined : connection.start()));
    const offline = connection.offline;
    const online = track;
    const hide = () => {
      suspended = true;
      offline();
    };
    const show = () => {
      suspended = false;
      online();
    };
    const visible = () => {
      if (document.visibilityState === "visible") track();
    };
    const heartbeat = setInterval(track, 25000);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    document.addEventListener("visibilitychange", visible);
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      clearInterval(heartbeat);
      trackRef.current = null;
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      document.removeEventListener("visibilitychange", visible);
      presenceRelease = Promise.all([presenceRelease, connection.stop()]).catch(() => undefined);
      setGames({});
      setStatuses({});
      setConnection("connecting");
      if (stopPresence === cleanup) stopPresence = null;
    };
    stopPresence = cleanup;
    return cleanup;
  }, [userId]);

  const setStatus = useCallback(
    async (status: SelectableStatus) => {
      if (!userId) return;
      await profilesService.update(userId, { status });
      statusRef.current = status;
      trackRef.current?.();
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    [userId, queryClient],
  );
  const value = useMemo<GlobalPresenceValue>(
    () => ({
      statuses,
      games,
      statusOf: (id) => (id ? (statuses[id] ?? "offline") : "offline"),
      isOnline: (id) => Boolean(id && statuses[id] && statuses[id] !== "offline"),
      myStatus: statuses[userId ?? ""] ?? "offline",
      setStatus,
      connection,
    }),
    [statuses, games, userId, setStatus, connection],
  );
  return <GlobalPresenceContext.Provider value={value}>{children}</GlobalPresenceContext.Provider>;
}
const FALLBACK: GlobalPresenceValue = {
  statuses: {},
  games: {},
  statusOf: () => "offline",
  isOnline: () => false,
  myStatus: "offline",
  setStatus: async () => undefined,
  connection: "connecting",
};
export function useGlobalPresence() {
  return useContext(GlobalPresenceContext) ?? FALLBACK;
}
export function teardownPresence() {
  stopPresence?.();
}
