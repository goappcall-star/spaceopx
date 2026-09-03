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

/** Statuses a user can pick. `offline` is derived, never chosen. */
export type SelectableStatus = Extract<UserStatus, "online" | "idle" | "dnd">;

export type ConnectionState = "connecting" | "online" | "reconnecting";

/** Re-announce presence this often so a stale client is detected quickly. */
const HEARTBEAT_MS = 25_000;
/** Tolerance before a vanished client is painted offline (suspend, flaky net). */
const GRACE_MS = 20_000;

interface GlobalPresenceValue {
  statuses: Record<string, UserStatus>;
  statusOf: (userId: string | null | undefined) => UserStatus;
  isOnline: (userId: string | null | undefined) => boolean;
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
  const [statuses, setStatuses] = useState<Record<string, UserStatus>>({});
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [myStatus, setMyStatus] = useState<SelectableStatus>("online");

  const trackRef = useRef<(() => void) | null>(null);
  const statusRef = useRef<SelectableStatus>("online");
  const graceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // The persisted profile status is the desired status; presence decides online.
  useEffect(() => {
    if (profileStatus && profileStatus !== "offline") {
      setMyStatus(profileStatus as SelectableStatus);
      statusRef.current = profileStatus as SelectableStatus;
    }
  }, [profileStatus]);

  useEffect(() => {
    const timers = graceTimers.current;
    if (!userId) {
      setStatuses({});
      setConnection("connecting");
      return;
    }

    // One shared channel per client — supabase-js refuses new listeners on an
    // already-subscribed topic, so the instance is reused across remounts.
    let disposed = false;
    const existing = supabase
      .getChannels()
      .find((c) => c.topic === "realtime:presence:global" && c.state !== "closed");
    const channel =
      existing ??
      supabase.channel("presence:global", { config: { presence: { key: userId } } });
    const fresh = !existing;

    const track = () => {
      if (disposed) return;
      void channel.track({ user_id: userId, status: statusRef.current, at: Date.now() });
    };
    trackRef.current = track;

    const sync = () => {
      const state = channel.presenceState<{ user_id: string; status: UserStatus }>();
      const present: Record<string, UserStatus> = {};
      for (const entries of Object.values(state)) {
        const first = entries[0];
        if (first?.user_id) present[first.user_id] = first.status ?? "online";
      }

      setStatuses((prev) => {
        const next: Record<string, UserStatus> = { ...prev, ...present };
        // Someone left: keep them visible during the tolerance window.
        for (const id of Object.keys(prev)) {
          if (!present[id] && !timers[id]) {
            timers[id] = setTimeout(() => {
              delete timers[id];
              setStatuses((current) => {
                const copy = { ...current };
                delete copy[id];
                return copy;
              });
            }, GRACE_MS);
          }
        }
        for (const id of Object.keys(present)) {
          const timer = timers[id];
          if (timer) {
            clearTimeout(timer);
            delete timers[id];
          }
        }
        return next;
      });
    };

    if (fresh) {
      channel
        .on("presence", { event: "sync" }, sync)
        .on("presence", { event: "join" }, sync)
        .on("presence", { event: "leave" }, sync)
        .subscribe((state) => {
          if (state === "SUBSCRIBED") {
            setConnection("online");
            track();
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            setConnection("reconnecting");
          }
        });
    } else {
      setConnection("online");
      sync();
      track();
    }

    const heartbeat = setInterval(track, HEARTBEAT_MS);
    const resync = setInterval(sync, 5_000);

    const onVisible = () => {
      if (document.visibilityState === "visible") track();
    };
    const onOnline = () => {
      setConnection("online");
      track();
    };
    const onOffline = () => setConnection("reconnecting");
    const onUnload = () => {
      void channel.untrack();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pagehide", onUnload);

    return () => {
      disposed = true;
      clearInterval(heartbeat);
      clearInterval(resync);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pagehide", onUnload);
      for (const timer of Object.values(timers)) clearTimeout(timer);
      for (const id of Object.keys(timers)) delete timers[id];
      trackRef.current = null;
      void channel.untrack().then(() => supabase.removeChannel(channel));
    };
  }, [userId]);


  const setStatus = useCallback(
    async (status: SelectableStatus) => {
      statusRef.current = status;
      setMyStatus(status);
      trackRef.current?.();
      if (!userId) return;
      await profilesService.update(userId, { status });
      void queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    [userId, queryClient],
  );

  const value = useMemo<GlobalPresenceValue>(() => {
    const resolved: Record<string, UserStatus> = { ...statuses };
    if (userId) resolved[userId] = myStatus;
    return {
      statuses: resolved,
      statusOf: (id) => (id ? (resolved[id] ?? "offline") : "offline"),
      isOnline: (id) => Boolean(id && resolved[id] && resolved[id] !== "offline"),
      myStatus: resolved[userId ?? ""] ?? myStatus,
      setStatus,
      connection,
    };
  }, [statuses, userId, myStatus, setStatus, connection]);

  return (
    <GlobalPresenceContext.Provider value={value}>{children}</GlobalPresenceContext.Provider>
  );
}

const FALLBACK: GlobalPresenceValue = {
  statuses: {},
  statusOf: () => "offline",
  isOnline: () => false,
  myStatus: "offline",
  setStatus: async () => undefined,
  connection: "connecting",
};

export function useGlobalPresence() {
  return useContext(GlobalPresenceContext) ?? FALLBACK;
}
