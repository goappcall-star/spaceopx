import type { CommunityProgression, CommunityXpEntry } from "@/types/community-progression";
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("Invalid progression data");
  return value as Record<string, unknown>;
}
function integer(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min)
    throw Error("Invalid progression number");
  return value;
}
export function parseCommunityProgression(value: unknown, serverId: string): CommunityProgression {
  const r = object(value);
  if (r["server_id"] !== serverId || typeof r["earning_enabled"] !== "boolean")
    throw Error("Invalid progression identity");
  const result: CommunityProgression = {
    server_id: serverId,
    xp: integer(r["xp"]),
    level: integer(r["level"], 1),
    level_floor: integer(r["level_floor"]),
    next_level_xp: integer(r["next_level_xp"], 1),
    curve_version: integer(r["curve_version"], 1),
    earning_enabled: r["earning_enabled"],
    daily_cap: integer(r["daily_cap"], 1),
    weekly_cap: integer(r["weekly_cap"], 1),
  };
  if (
    result.level_floor > result.xp ||
    result.next_level_xp <= result.xp ||
    result.daily_cap > result.weekly_cap
  )
    throw Error("Inconsistent progression bounds");
  return result;
}
export function parseCommunityXpHistory(value: unknown): CommunityXpEntry[] {
  if (!Array.isArray(value) || value.length > 50) throw Error("Invalid progression history");
  let previous: bigint | null = null;
  return value.map((v) => {
    const r = object(v),
      id = r["id"],
      date = r["created_at"],
      outcome = r["outcome"];
    if (
      typeof id !== "string" ||
      !/^[1-9][0-9]{0,18}$/.test(id) ||
      BigInt(id) > 9223372036854775807n ||
      (previous !== null && BigInt(id) >= previous) ||
      typeof date !== "string" ||
      !Number.isFinite(Date.parse(date)) ||
      (outcome !== "granted" && outcome !== "capped")
    )
      throw Error("Invalid progression entry");
    previous = BigInt(id);
    const entry: CommunityXpEntry = {
      id,
      created_at: date,
      outcome,
      awarded_xp: integer(r["awarded_xp"]),
      requested_xp: integer(r["requested_xp"], 1),
      total_after: integer(r["total_after"]),
      policy_revision: integer(r["policy_revision"], 1),
    };
    if (
      entry.awarded_xp > entry.requested_xp ||
      entry.total_after < entry.awarded_xp ||
      (outcome === "granted") !== entry.awarded_xp > 0
    )
      throw Error("Invalid progression award");
    return entry;
  });
}
export function communityProgressPercent(data: CommunityProgression): number {
  return Math.max(
    0,
    Math.min(100, (100 * (data.xp - data.level_floor)) / (data.next_level_xp - data.level_floor)),
  );
}
