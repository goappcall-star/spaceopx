import { supabase } from "@/integrations/supabase/client";
import type { AuditLogEntry, Role, RolePermissions, ServerBanEntry } from "@/types";

export const SERVER_ADMIN_ERRORS: Record<string, string> = {
  "row-level security": "Você não tem permissão para esta ação.",
  "violates row-level": "Você não tem permissão para esta ação.",
  not_authorized: "Você não tem permissão para esta ação.",
  duplicate: "Esse registro já existe.",
};

export function adminErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const key = Object.keys(SERVER_ADMIN_ERRORS).find((k) => raw.includes(k));
  return SERVER_ADMIN_ERRORS[key ?? ""] ?? "Não foi possível concluir a operação.";
}

export interface RoleInput {
  name: string;
  color: string;
  permissions: RolePermissions;
  position?: number;
}

export const serverAdminService = {
  /* ------------------------------------------------------------- roles */
  async createRole(serverId: string, input: RoleInput): Promise<Role> {
    const { data, error } = await supabase
      .from("roles")
      .insert({
        server_id: serverId,
        name: input.name.trim(),
        color: input.color,
        permissions: input.permissions as Record<string, never>,
        position: input.position ?? 10,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as Role;
  },

  async updateRole(roleId: string, patch: Partial<RoleInput>) {
    const clean: Record<string, unknown> = {};
    if (patch.name !== undefined) clean["name"] = patch.name.trim();
    if (patch.color !== undefined) clean["color"] = patch.color;
    if (patch.permissions !== undefined) clean["permissions"] = patch.permissions;
    if (patch.position !== undefined) clean["position"] = patch.position;
    const { data, error } = await supabase
      .from("roles")
      .update(clean as Record<string, never>)
      .eq("id", roleId)
      .select("*")
      .single();
    if (error) throw error;
    return data as unknown as Role;
  },

  async deleteRole(roleId: string) {
    const { error } = await supabase.from("roles").delete().eq("id", roleId);
    if (error) throw error;
  },

  /** Swap the `position` of two roles to move one up/down in the hierarchy. */
  async swapRolePositions(a: Role, b: Role) {
    await serverAdminService.updateRole(a.id, { position: b.position });
    await serverAdminService.updateRole(b.id, { position: a.position });
  },

  /* ----------------------------------------------------------- members */
  async setMemberRoles(memberId: string, roleIds: string[], currentRoleIds: string[]) {
    const toAdd = roleIds.filter((id) => !currentRoleIds.includes(id));
    const toRemove = currentRoleIds.filter((id) => !roleIds.includes(id));
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from("member_roles")
        .delete()
        .eq("member_id", memberId)
        .in("role_id", toRemove);
      if (error) throw error;
    }
    if (toAdd.length > 0) {
      const { error } = await supabase
        .from("member_roles")
        .insert(toAdd.map((role_id) => ({ member_id: memberId, role_id })));
      if (error) throw error;
    }
  },

  async kickMember(memberId: string) {
    const { error } = await supabase.from("server_members").delete().eq("id", memberId);
    if (error) throw error;
  },

  /* -------------------------------------------------------------- bans */
  async listBans(serverId: string): Promise<ServerBanEntry[]> {
    const { data, error } = await supabase.rpc("list_server_bans", { _server_id: serverId });
    if (error) throw error;
    return (data ?? []) as ServerBanEntry[];
  },

  /** The DB trigger removes the membership and writes the audit entry. */
  async banMember(serverId: string, userId: string, reason: string | null, actorId: string) {
    const { error } = await supabase.from("server_bans").insert({
      server_id: serverId,
      user_id: userId,
      banned_by: actorId,
      reason: reason?.trim() || null,
    });
    if (error) throw error;
  },

  async unbanUser(banId: string) {
    const { error } = await supabase.from("server_bans").delete().eq("id", banId);
    if (error) throw error;
  },

  /* ------------------------------------------------------------- audit */
  async listAuditLogs(serverId: string, limit = 100): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase.rpc("list_server_audit_logs", {
      _server_id: serverId,
      _limit: limit,
    });
    if (error) throw error;
    return (data ?? []) as unknown as AuditLogEntry[];
  },
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  server_created: "Servidor criado",
  server_updated: "Servidor alterado",
  settings_updated: "Configuração alterada",
  role_created: "Cargo criado",
  role_updated: "Cargo alterado",
  role_permissions_updated: "Permissões alteradas",
  role_deleted: "Cargo excluído",
  invite_created: "Convite criado",
  invite_revoked: "Convite revogado",
  member_kicked: "Membro removido",
  member_left: "Membro saiu",
  member_banned: "Membro banido",
  member_unbanned: "Membro desbanido",
};

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
