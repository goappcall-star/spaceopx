import type { MemberWithProfile, Role } from "@/types";
export function memberAliasKey(viewer: string | undefined, target: string) {
  return `lobbyx:friend-alias:${viewer}:${target}`;
}
export function groupMembersByRole(members: MemberWithProfile[]) {
  const groups = new Map<string, { role: Role | null; members: MemberWithProfile[] }>();
  for (const member of members) {
    const role =
      [...member.roles].sort((a, b) => b.position - a.position || a.id.localeCompare(b.id))[0] ??
      null;
    const id = role?.id ?? "unassigned";
    if (!groups.has(id)) groups.set(id, { role, members: [] });
    groups.get(id)!.members.push(member);
  }
  return [...groups.values()]
    .sort(
      (a, b) =>
        (b.role?.position ?? -1) - (a.role?.position ?? -1) ||
        (a.role?.id ?? "").localeCompare(b.role?.id ?? ""),
    )
    .map((group) => ({
      ...group,
      members: group.members.sort((a, b) =>
        (a.nickname ?? a.profile?.display_name ?? "").localeCompare(
          b.nickname ?? b.profile?.display_name ?? "",
          "pt-BR",
        ),
      ),
    }));
}
