import { supabase } from "@/integrations/supabase/client";
import {
  parseCommunityObjectives,
  parseObjectivePage,
  parseMission,
  parseAchievement,
} from "@/lib/community-objectives";
export const communityObjectivesService = {
  async get(serverId: string) {
    const { data, error } = await supabase.rpc("get_community_objectives", {
      _server_id: serverId,
    });
    if (error) throw error;
    return parseCommunityObjectives(data, serverId);
  },
  async achievements(serverId: string, after?: string) {
    const { data, error } = await supabase.rpc("list_community_achievements", {
      _server_id: serverId,
      _limit: 20,
      ...(after ? { _after: after } : {}),
    });
    if (error) throw error;
    return parseObjectivePage(data, parseAchievement);
  },
  async history(serverId: string, before?: string) {
    const { data, error } = await supabase.rpc("list_community_mission_history", {
      _server_id: serverId,
      _limit: 20,
      ...(before ? { _before: before } : {}),
    });
    if (error) throw error;
    return parseObjectivePage(data, parseMission);
  },
};
