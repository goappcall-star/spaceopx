import type { MemberWithProfile, PermissionKey } from "@/types";

/** Permissions every member has unless a role explicitly sets them to false. */
const BASELINE: PermissionKey[] = ["view_channel", "send_messages", "connect", "speak"];

/**
 * UI-level mirror of the SQL `has_channel_permission` function. Purely cosmetic:
 * the database is what actually enforces access.
 */
export function hasPermission(
  member: MemberWithProfile | undefined,
  permission: PermissionKey,
): boolean {
  if (!member) return false;
  const roles = member.roles ?? [];
  if (roles.some((r) => r.name === "OWNER")) return true;
  if (roles.some((r) => r.permissions?.["administrator"] || r.permissions?.["manage_server"]))
    return true;
  if (roles.some((r) => r.permissions?.[permission] === true)) return true;
  if (BASELINE.includes(permission)) {
    return !roles.some((r) => r.permissions?.[permission] === false);
  }
  return false;
}
