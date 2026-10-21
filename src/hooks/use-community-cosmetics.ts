import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { communityEvolutionService } from "@/services/community-evolution";
export function useCommunityCosmetics(serverId: string, userId: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (!COMMUNITY_V1_ENABLED) return;
    return client.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "invalidate") return;
      const [kind, ...scope] = event.query.queryKey;
      if (
        ["roles", "members", "community", "community-experience"].includes(String(kind)) &&
        scope.includes(serverId)
      )
        void client.invalidateQueries(
          { queryKey: ["community-cosmetics", userId, serverId] },
          { cancelRefetch: false },
        );
    });
  }, [client, serverId, userId]);
  return useQuery({
    queryKey: ["community-cosmetics", userId, serverId],
    queryFn: () => communityEvolutionService.cosmetics(serverId),
    enabled: COMMUNITY_V1_ENABLED,
    staleTime: 15000,
    gcTime: 0,
    retry: false,
  });
}
