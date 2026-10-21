import type {
  CommunityMission,
  CommunityAchievement,
  CommunityObjectives,
  MissionStatus,
} from "@/types/community-objectives";
const invalid = (): never => {
  throw Error("Invalid community objective data");
};
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return invalid();
  return v as Record<string, unknown>;
}
function text(v: unknown, max = 1000): string {
  if (typeof v !== "string" || !v.length || v.length > max) return invalid();
  return v;
}
function key(v: unknown): string {
  const s = text(v, 64);
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(s)) return invalid();
  return s;
}
function num(v: unknown, min = 0, max = 10000): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) return invalid();
  return v;
}
function stamp(v: unknown): string {
  const s = text(v, 50);
  if (!Number.isFinite(Date.parse(s))) return invalid();
  return s;
}
function optionalKey(v: unknown): string | null {
  return v === null ? null : key(v);
}
export function parseMission(v: unknown): CommunityMission {
  const r = obj(v),
    status = text(r["status"]) as MissionStatus,
    cadence = r["cadence"];
  if (
    !["unavailable", "available", "in_progress", "completed", "expired"].includes(status) ||
    (cadence !== "daily" && cadence !== "weekly")
  )
    return invalid();
  const id = r["id"] === null ? null : text(r["id"], 19);
  if (id !== null && (!/^[1-9][0-9]*$/.test(id) || BigInt(id) > 9223372036854775807n))
    return invalid();
  const m: CommunityMission = {
    id,
    objective_id: key(r["objective_id"]),
    version: num(r["version"], 1, 2147483647),
    name: text(r["name"], 100),
    description: text(r["description"]),
    cadence,
    target: num(r["target"], 1),
    progress: num(r["progress"]),
    period_start: stamp(r["period_start"]),
    expires_at: stamp(r["expires_at"]),
    completed_at: r["completed_at"] === null ? null : stamp(r["completed_at"]),
    status,
    reward_xp: num(r["reward_xp"]),
    awarded_xp: r["awarded_xp"] === null ? null : num(r["awarded_xp"]),
    reward_id: optionalKey(r["reward_id"]),
  };
  if (
    m.progress > m.target ||
    Date.parse(m.expires_at) <= Date.parse(m.period_start) ||
    (status === "completed") !== (m.completed_at !== null) ||
    (m.completed_at !== null && m.progress !== m.target) ||
    (status === "available" && m.progress !== 0) ||
    (m.awarded_xp !== null && m.awarded_xp > m.reward_xp)
  )
    return invalid();
  return m;
}
export function parseAchievement(v: unknown): CommunityAchievement {
  const r = obj(v),
    criterion = r["criterion"],
    category = r["category"],
    rarity = r["rarity"];
  if (
    (criterion !== "first_activation" && criterion !== "first_publication") ||
    (category !== "foundation" && category !== "participation") ||
    !["common", "rare", "epic", "legendary"].includes(String(rarity))
  )
    return invalid();
  return {
    objective_id: key(r["objective_id"]),
    version: num(r["version"], 1, 2147483647),
    name: text(r["name"], 100),
    description: text(r["description"]),
    criterion,
    category,
    rarity: rarity as CommunityAchievement["rarity"],
    unlocked_at: r["unlocked_at"] === null ? null : stamp(r["unlocked_at"]),
    reward_id: optionalKey(r["reward_id"]),
  };
}
export function parseObjectivePage<T>(v: unknown, parse: (v: unknown) => T, max = 50): T[] {
  if (!Array.isArray(v) || v.length > max) return invalid();
  return v.map(parse);
}
export function parseCommunityObjectives(v: unknown, serverId: string): CommunityObjectives {
  const r = obj(v);
  if (r["server_id"] !== serverId || typeof r["verifier_enabled"] !== "boolean") return invalid();
  return {
    server_id: serverId,
    verifier_enabled: r["verifier_enabled"],
    missions: parseObjectivePage(r["missions"], parseMission, 16),
    recent_achievements: parseObjectivePage(r["recent_achievements"], parseAchievement, 3),
  };
}
