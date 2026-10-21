import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { communityExperienceService } from "@/services/community-experience";
export function useCommunityExperience(serverId: string | null, userId: string | undefined) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["community-experience", userId, serverId],
    queryFn: () => communityExperienceService.get(serverId!),
    enabled: COMMUNITY_V1_ENABLED && !!serverId && !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: (q) => (COMMUNITY_V1_ENABLED && q.state.data !== null ? 15000 : false),
  });
  useEffect(() => {
    if (!COMMUNITY_V1_ENABLED) return;
    return client.getQueryCache().subscribe((e) => {
      if (
        e.type === "updated" &&
        e.action.type === "invalidate" &&
        ["roles", "members", "channels", "community", "servers"].includes(
          String(e.query.queryKey[0]),
        )
      )
        void client.invalidateQueries({ queryKey: ["community-experience", userId, serverId] });
    });
  }, [client, serverId, userId]);
  return query;
}
