import { supabase } from "@/integrations/supabase/client";
import { parseCommunityCosmetics, parseCommunityStatistics } from "@/lib/community-evolution";
import type { CosmeticSlot } from "@/types/community-evolution";
export const communityEvolutionService = {
  async cosmetics(serverId: string) {
    const { data, error } = await supabase.rpc("get_community_cosmetics", { _server_id: serverId });
    if (error) throw error;
    return parseCommunityCosmetics(data, serverId);
  },
  async equip(serverId: string, slot: CosmeticSlot, rewardId: string | null, revision: number) {
    const { data, error } = await supabase.rpc("equip_community_cosmetic", {
      _server_id: serverId,
      _slot: slot,
      _reward_id: rewardId,
      _expected_revision: revision,
    });
    if (error) throw error;
    return parseCommunityCosmetics(data, serverId);
  },
  async statistics(serverId: string, from: string, to: string, before?: string) {
    const { data, error } = await supabase.rpc("get_community_statistics", {
      _server_id: serverId,
      _from: from,
      _to: to,
      _limit: 20,
      ...(before ? { _before: before } : {}),
    });
    if (error) throw error;
    return parseCommunityStatistics(data, serverId);
  },
};
