export type MissionStatus = "unavailable" | "available" | "in_progress" | "completed" | "expired";
export interface CommunityMission {
  id: string | null;
  objective_id: string;
  version: number;
  name: string;
  description: string;
  cadence: "daily" | "weekly";
  target: number;
  progress: number;
  period_start: string;
  expires_at: string;
  completed_at: string | null;
  status: MissionStatus;
  reward_xp: number;
  awarded_xp: number | null;
  reward_id: string | null;
}
export interface CommunityAchievement {
  objective_id: string;
  version: number;
  name: string;
  description: string;
  criterion: "first_activation" | "first_publication";
  category: "foundation" | "participation";
  rarity: "common" | "rare" | "epic" | "legendary";
  unlocked_at: string | null;
  reward_id: string | null;
}
export interface CommunityObjectives {
  server_id: string;
  missions: CommunityMission[];
  recent_achievements: CommunityAchievement[];
  verifier_enabled: boolean;
}
