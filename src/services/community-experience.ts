import { supabase } from "@/integrations/supabase/client";
import { parseExperience, validateExperience } from "@/lib/community-experience";
import type {
  CommunityExperience,
  CommunityExperienceConfig,
  OnboardingInput,
} from "@/types/community-experience";
import type { Json } from "@/integrations/supabase/types";
export const communityExperienceService = {
  async get(serverId: string) {
    const { data, error } = await supabase.rpc("get_community_experience", {
      _server_id: serverId,
    });
    if (error) throw error;
    return parseExperience(data, serverId);
  },
  async save(serverId: string, config: CommunityExperienceConfig, revision: number) {
    const { data, error } = await supabase.rpc("save_community_experience", {
      _server_id: serverId,
      _payload: validateExperience(config) as unknown as Json,
      _expected_revision: revision,
    });
    if (error) throw error;
    if (!Number.isInteger(data)) throw Error("community_invalid_response");
    return data;
  },
  async onboard(data: CommunityExperience, input: OnboardingInput) {
    const { error } = await supabase.rpc("save_community_onboarding", {
      _server_id: data.server_id,
      _experience_revision: data.revision,
      _rules_revision: data.rules_revision,
      _accept_rules: input.accept,
      _interests: input.interests,
      _role_ids: input.roles,
      _complete: input.complete,
    });
    if (error) throw error;
  },
};
