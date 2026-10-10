import { useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { measureOperation } from "@/services/performance/monitor";
import { unreadService } from "@/services/unread";
export function useServerUnread(userId: string | undefined) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["server-unread", userId],
    queryFn: () => unreadService.list(),
    enabled: !!userId,
    staleTime: 30000,
  });
  const refresh = useCallback(() => {
    const finish = measureOperation("notification.refresh");
    void client
      .invalidateQueries({ queryKey: ["server-unread", userId] }, { throwOnError: true })
      .then(
        () => finish(),
        () => finish(true),
      );
  }, [client, userId]);
  useEffect(() => {
    if (!userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingPermissions = false;
    const schedule = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (pendingPermissions) {
          pendingPermissions = false;
          for (const key of ["servers", "members", "roles", "channels"]) {
            void client.invalidateQueries({ queryKey: [key] });
          }
        }
        refresh();
      }, 200);
    };
    const permissionsChanged = () => {
      pendingPermissions = true;
      schedule();
    };
    const channel = supabase
      .channel(`read-states:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, schedule)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_read_states",
          filter: `user_id=eq.${userId}`,
        },
        schedule,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "permission_invalidations",
          filter: `user_id=eq.${userId}`,
        },
        permissionsChanged,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "permission_invalidations",
          filter: `user_id=eq.${userId}`,
        },
        permissionsChanged,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, schedule)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") schedule();
      });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh, client]);
  return useMemo(() => {
    const rows = query.data ?? [];
    const serverCounts: Record<string, number> = {},
      channelCounts: Record<string, number> = {},
      serverMentions: Record<string, number> = {},
      mentions: Record<string, number> = {};
    for (const row of rows) {
      channelCounts[row.channel_id] = row.unread_count;
      mentions[row.channel_id] = row.mention_count;
      serverCounts[row.server_id] = (serverCounts[row.server_id] ?? 0) + row.unread_count;
      serverMentions[row.server_id] = (serverMentions[row.server_id] ?? 0) + row.mention_count;
    }
    return {
      unread: new Set(rows.filter((r) => r.unread_count > 0).map((r) => r.channel_id)),
      serverCounts,
      serverMentions,
      channelCounts,
      mentions,
      refresh,
    };
  }, [query.data, refresh]);
}
