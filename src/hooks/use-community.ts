import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { communitiesService } from "@/services/communities";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";

export function useCommunity(serverId: string, userId: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["community", userId, serverId],
    queryFn: () => communitiesService.get(serverId),
    enabled: COMMUNITY_V1_ENABLED && Boolean(userId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: COMMUNITY_V1_ENABLED ? 15_000 : false,
  });
  useEffect(() => {
    if (!COMMUNITY_V1_ENABLED) return;
    return client.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "invalidate" &&
        ["roles", "members", "servers", "channels"].includes(String(event.query.queryKey[0]))
      ) {
        void client.invalidateQueries({ queryKey: ["community", userId, serverId] });
      }
    });
  }, [client, userId, serverId]);
  return query;
}
