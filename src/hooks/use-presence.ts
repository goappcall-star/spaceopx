import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { UserStatus } from "@/types";

export type PresenceStatus = UserStatus | "dnd";

/**
 * Server-wide realtime presence. One channel per server, tracked by user id, so
 * a user connected from two tabs collapses into a single presence key.
 */
export function useServerPresence(
  serverId: string | null,
  userId: string | undefined,
  status: PresenceStatus,
) {
  const [presence, setPresence] = useState<Record<string, PresenceStatus>>({});

  useEffect(() => {
    if (!serverId || !userId) {
      setPresence({});
      return;
    }

    const channel = supabase.channel(`presence:server:${serverId}`, {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState<{ user_id: string; status: PresenceStatus }>();
      const next: Record<string, PresenceStatus> = {};
      for (const entries of Object.values(state)) {
        const first = entries[0];
        if (first?.user_id) next[first.user_id] = first.status ?? "online";
      }
      setPresence(next);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .subscribe(async (state) => {
        if (state === "SUBSCRIBED") {
          await channel.track({ user_id: userId, status });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [serverId, userId, status]);

  return presence;
}
