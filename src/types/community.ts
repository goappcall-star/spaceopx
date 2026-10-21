export type CommunityCategory =
  "gaming" | "technology" | "creative" | "education" | "social" | "other";
export interface CommunityRule {
  id: string;
  text: string;
}
export interface CommunityPayload {
  rules: CommunityRule[];
  welcome_channel_id: string;
  category_slug: CommunityCategory;
  interests: string[];
}
export interface CommunitySettings extends Omit<CommunityPayload, "welcome_channel_id"> {
  server_id: string;
  enabled: boolean;
  welcome_channel_id: string | null;
  revision: number;
  rules_revision: number;
  activated_at: string | null;
  disabled_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface CommunityState {
  can_manage: boolean;
  is_owner: boolean;
  settings: CommunitySettings | null;
}
