export interface CommunityProgression {
  server_id: string;
  xp: number;
  level: number;
  level_floor: number;
  next_level_xp: number;
  curve_version: number;
  earning_enabled: boolean;
  daily_cap: number;
  weekly_cap: number;
}
export interface CommunityXpEntry {
  id: string;
  awarded_xp: number;
  requested_xp: number;
  outcome: "granted" | "capped";
  total_after: number;
  policy_revision: number;
  created_at: string;
}
