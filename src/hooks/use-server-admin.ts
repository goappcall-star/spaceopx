import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { adminErrorMessage, serverAdminService } from "@/services/server-admin";
import { memberHasPermission, type ServerPermission } from "@/services/permissions";
import { rolesService } from "@/services/roles";
import type { MemberWithProfile, Server } from "@/types";

export function useServerRoles(serverId: string | null) {
  return useQuery({
    queryKey: ["roles", serverId],
    queryFn: () => rolesService.listByServer(serverId as string),
    enabled: Boolean(serverId),
  });
}

export function useServerBans(serverId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["server-bans", serverId],
    queryFn: () => serverAdminService.listBans(serverId as string),
    enabled: Boolean(serverId) && enabled,
  });
}

export function useServerAuditLogs(serverId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["audit-logs", serverId],
    queryFn: () => serverAdminService.listAuditLogs(serverId as string),
    enabled: Boolean(serverId) && enabled,
  });
}

/** Permission map for the current user in a server — UI gating only. */
export function useServerAbilities(
  server: Server | undefined | null,
  members: MemberWithProfile[] | undefined,
  userId: string | undefined,
) {
  const me = members?.find((m) => m.user_id === userId) ?? null;
  const can = (permission: ServerPermission) =>
    memberHasPermission(me, server?.owner_id, permission);
  return {
    me,
    isOwner: Boolean(server && userId && server.owner_id === userId),
    can,
    canOpenSettings:
      can("manage_server") ||
      can("manage_roles") ||
      can("manage_members") ||
      can("create_invite") ||
      can("ban_members") ||
      can("view_audit_log"),
  };
}

/** Wraps a mutation with consistent toasts and cache invalidation. */
export function useAdminMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  options: { success: string; invalidate: unknown[][] },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      toast.success(options.success);
      for (const key of options.invalidate) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onError: (error) => toast.error(adminErrorMessage(error)),
  });
}
