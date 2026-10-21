import type { CommunityRule } from "./community";
export type CommunityModule = "notices" | "voice" | "channels" | "interests" | "events";
export interface CommunityExperienceConfig {
  home_enabled: boolean;
  intro: string;
  banner_url: string | null;
  notices: { id: string; title: string; body: string }[];
  featured_channels: string[];
  modules: CommunityModule[];
  welcome_enabled: boolean;
  welcome_text: string;
  rules_enabled: boolean;
  rules_required: boolean;
  interests_enabled: boolean;
  channels_enabled: boolean;
  roles_enabled: boolean;
  role_ids: string[];
}
export interface CommunityExperience {
  server_id: string;
  revision: number;
  rules_revision: number;
  can_manage: boolean;
  screened: boolean;
  experience: CommunityExperienceConfig;
  rules: CommunityRule[];
  interests: string[];
  progress: {
    accepted_revision: number | null;
    interests: string[];
    selected_roles: string[];
    completed_revision: number | null;
    updated_at: string;
  } | null;
}
export interface OnboardingInput {
  accept: boolean;
  interests: string[];
  roles: string[];
  complete: boolean;
}
