import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { communityEventsService } from "@/services/community-events";
import type { EventMode } from "@/types/community-events";
export function useCommunityEvents(
  serverId: string,
  userId: string,
  mode: EventMode,
  cursor?: { starts_at: string; id: string },
) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["community-events", userId, serverId, mode, cursor ?? null],
    queryFn: () => communityEventsService.list(serverId, mode, cursor),
    enabled: COMMUNITY_V1_ENABLED,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: 20000,
  });
  useEffect(() => {
    if (!COMMUNITY_V1_ENABLED) return;
    return client.getQueryCache().subscribe((e) => {
      if (
        e.type === "updated" &&
        e.action.type === "invalidate" &&
        ["roles", "members", "channels", "community", "community-experience"].includes(
          String(e.query.queryKey[0]),
        )
      )
        void client.invalidateQueries({ queryKey: ["community-events", userId, serverId] });
    });
  }, [client, serverId, userId]);
  return query;
}
export function useCommunityEventInbox(userId: string | undefined) {
  return useQuery({
    queryKey: ["community-event-inbox", userId],
    queryFn: () => communityEventsService.notifications(),
    enabled: COMMUNITY_V1_ENABLED && !!userId,
    staleTime: 10000,
    gcTime: 0,
    retry: false,
    refetchInterval: 20000,
    refetchIntervalInBackground: true,
  });
}
