import { useQuery } from "@tanstack/react-query";

import { channelsService } from "@/services/channels";
import { membersService } from "@/services/members";
import { serversService } from "@/services/servers";
import type { MemberWithProfile } from "@/types";

export function useMyServers(enabled = true) {
  return useQuery({
    queryKey: ["servers"],
    queryFn: () => serversService.listMine(),
    enabled,
  });
}

export function useServerChannels(serverId: string | null) {
  return useQuery({
    queryKey: ["channels", serverId],
    queryFn: () => channelsService.listByServer(serverId as string),
    enabled: Boolean(serverId),
  });
}

export function useServerMembers(serverId: string | null) {
  return useQuery({
    queryKey: ["members", serverId],
    queryFn: () => membersService.listByServer(serverId as string),
    enabled: Boolean(serverId),
  });
}

/**
 * UI-level permission hint. Authorization itself is always enforced by RLS —
 * this only decides whether a control is worth rendering.
 */
export function useServerPermissions(members: MemberWithProfile[] | undefined, userId?: string) {
  const me = members?.find((m) => m.user_id === userId);
  const roleNames = me?.roles.map((r) => r.name) ?? [];
  const isOwner = roleNames.includes("OWNER");
  const isAdmin = isOwner || roleNames.includes("ADMIN");
  return { me, roleNames, isOwner, isAdmin, canManage: isAdmin };
}
