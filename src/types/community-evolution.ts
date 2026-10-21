import type { CommunityProgression } from "./community-progression";
export type CosmeticSlot = "theme" | "banner" | "seal" | "frame" | "highlight";
export type RenderKey =
  "orbit_theme" | "grid_banner" | "foundation_seal" | "orbit_frame" | "lime_highlight";
export type Appearance = Partial<Record<CosmeticSlot, RenderKey>>;
export interface CommunityCosmetic {
  id: string;
  name: string;
  description: string;
  slot: CosmeticSlot;
  render_key: RenderKey;
  owned: boolean;
  available: boolean;
  requires_mission: boolean;
}
export interface CommunityCosmetics {
  server_id: string;
  revision: number;
  can_manage: boolean;
  selection: Partial<Record<CosmeticSlot, string>>;
  equipped: Appearance;
  items: CommunityCosmetic[];
}
export interface CommunityStatistics {
  server_id: string;
  from: string;
  to: string;
  progression: CommunityProgression;
  xp_received: number;
  missions_completed: number;
  achievements_unlocked: number;
  members_current: number;
  member_growth: null;
  events_realized: null;
  attendance_verified: null;
  events_created: number;
  events_scheduled: number;
  events_cancelled: number;
  rsvp_going: number;
  daily: { day: string; xp: number; balance: number }[];
  history: {
    id: string;
    awarded_xp: number;
    requested_xp: number;
    total_after: number;
    created_at: string;
  }[];
}
