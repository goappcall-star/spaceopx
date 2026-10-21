import { supabase } from "@/integrations/supabase/client";
import { parseCommunityProgression, parseCommunityXpHistory } from "@/lib/community-progression";
export const communityProgressionService = {
  async get(serverId: string) {
    const { data, error } = await supabase.rpc("get_community_progression", {
      _server_id: serverId,
    });
    if (error) throw error;
    return parseCommunityProgression(data, serverId);
  },
  async history(serverId: string, before?: string) {
    const { data, error } = await supabase.rpc("list_community_xp_history", {
      _server_id: serverId,
      _limit: 20,
      ...(before ? { _before: before } : {}),
    });
    if (error) throw error;
    return parseCommunityXpHistory(data);
  },
};
