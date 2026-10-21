import { useQuery } from "@tanstack/react-query";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { communityEvolutionService } from "@/services/community-evolution";
export function useCommunityCosmetics(serverId: string, userId: string) {
  return useQuery({
    queryKey: ["community-cosmetics", userId, serverId],
    queryFn: () => communityEvolutionService.cosmetics(serverId),
    enabled: COMMUNITY_V1_ENABLED,
    staleTime: 15000,
    gcTime: 0,
    retry: false,
  });
}
