import { parseCommunityProgression } from "@/lib/community-progression";
import type {
  CommunityCosmetics,
  CommunityStatistics,
  CosmeticSlot,
  RenderKey,
  Appearance,
} from "@/types/community-evolution";
export const COSMETIC_RENDERERS: Record<CosmeticSlot, RenderKey> = {
  theme: "orbit_theme",
  banner: "grid_banner",
  seal: "foundation_seal",
  frame: "orbit_frame",
  highlight: "lime_highlight",
};
const fail = (): never => {
  throw Error("Invalid community evolution response");
};
function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
  return v as Record<string, unknown>;
}
function integer(v: unknown): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) return fail();
  return v;
}
function text(v: unknown, max = 1000): string {
  if (typeof v !== "string" || !v.length || v.length > max) return fail();
  return v;
}
function bool(v: unknown): boolean {
  if (typeof v !== "boolean") return fail();
  return v;
}
function array(v: unknown, max: number): unknown[] {
  if (!Array.isArray(v) || v.length > max) return fail();
  return v;
}
export function parseCommunityCosmetics(v: unknown, serverId: string): CommunityCosmetics {
  const r = record(v);
  if (r["server_id"] !== serverId) return fail();
  const items = array(r["items"], 20).map((v) => {
    const a = record(v),
      slot = text(a["slot"]) as CosmeticSlot,
      render = text(a["render_key"]) as RenderKey;
    if (COSMETIC_RENDERERS[slot] !== render) return fail();
    const id = text(a["id"], 64);
    if (!/^lx_[a-z_]+$/.test(id)) return fail();
    return {
      id,
      name: text(a["name"], 100),
      description: text(a["description"], 500),
      slot,
      render_key: render,
      owned: bool(a["owned"]),
      available: bool(a["available"]),
      requires_mission: bool(a["requires_mission"]),
    };
  });
  if (
    new Set(items.map((i) => i.id)).size !== items.length ||
    items.some((i) => i.available && !i.owned)
  )
    return fail();
  const equipped: Appearance = {},
    selection: CommunityCosmetics["selection"] = {};
  for (const [slot, value] of Object.entries(record(r["equipped"]))) {
    if (COSMETIC_RENDERERS[slot as CosmeticSlot] !== value) return fail();
    equipped[slot as CosmeticSlot] = value as RenderKey;
  }
  for (const [slot, value] of Object.entries(record(r["selection"]))) {
    if (!items.some((i) => i.slot === slot && i.id === value)) return fail();
    selection[slot as CosmeticSlot] = value as string;
  }
  return {
    server_id: serverId,
    revision: integer(r["revision"]),
    can_manage: bool(r["can_manage"]),
    equipped,
    selection,
    items,
  };
}
export function parseCommunityStatistics(v: unknown, serverId: string): CommunityStatistics {
  const r = record(v);
  if (
    r["server_id"] !== serverId ||
    r["member_growth"] !== null ||
    r["events_realized"] !== null ||
    r["attendance_verified"] !== null
  )
    return fail();
  const from = text(r["from"], 10),
    to = text(r["to"], 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
    Date.parse(to) <= Date.parse(from) ||
    Date.parse(to) - Date.parse(from) > 93 * 86400000
  )
    return fail();
  const out: CommunityStatistics = {
    server_id: serverId,
    from,
    to,
    progression: parseCommunityProgression(r["progression"], serverId),
    xp_received: integer(r["xp_received"]),
    missions_completed: integer(r["missions_completed"]),
    achievements_unlocked: integer(r["achievements_unlocked"]),
    members_current: integer(r["members_current"]),
    member_growth: null,
    events_realized: null,
    attendance_verified: null,
    events_created: integer(r["events_created"]),
    events_scheduled: integer(r["events_scheduled"]),
    events_cancelled: integer(r["events_cancelled"]),
    rsvp_going: integer(r["rsvp_going"]),
    daily: array(r["daily"], 93).map((v) => {
      const d = record(v);
      return { day: text(d["day"], 10), xp: integer(d["xp"]), balance: integer(d["balance"]) };
    }),
    history: array(r["history"], 50).map((v) => {
      const e = record(v),
        id = text(e["id"], 19),
        stamp = text(e["created_at"], 50);
      if (
        !/^[1-9][0-9]*$/.test(id) ||
        BigInt(id) > 9223372036854775807n ||
        !Number.isFinite(Date.parse(stamp))
      )
        return fail();
      const awarded = integer(e["awarded_xp"]),
        requested = integer(e["requested_xp"]);
      if (awarded > requested) return fail();
      return {
        id,
        created_at: stamp,
        awarded_xp: awarded,
        requested_xp: requested,
        total_after: integer(e["total_after"]),
      };
    }),
  };
  if (
    out.daily.some((d) => d.day < from || d.day >= to) ||
    out.daily.reduce((n, d) => n + d.xp, 0) !== out.xp_received
  )
    return fail();
  return out;
}
