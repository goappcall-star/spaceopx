import { supabase } from "@/integrations/supabase/client";
import type { MemberRole, MemberWithProfile, Role, ServerMember } from "@/types";
import { profilesService } from "./profiles";
import { rolesService } from "./roles";

export const membersService = {
  /**
   * server_members.user_id points at auth.users, so profiles cannot be embedded
   * by PostgREST — they are fetched and joined explicitly (still under RLS).
   */
  async listByServer(serverId: string): Promise<MemberWithProfile[]> {
    const { data: members, error } = await supabase
      .from("server_members")
      .select("*")
      .eq("server_id", serverId)
      .order("joined_at", { ascending: true });
    if (error) throw error;

    const rows = (members ?? []) as ServerMember[];
    if (rows.length === 0) return [];

    const [profiles, roles, memberRoles] = await Promise.all([
      profilesService.listByIds(rows.map((m) => m.user_id)),
      rolesService.listByServer(serverId),
      supabase
        .from("member_roles")
        .select("*")
        .in(
          "member_id",
          rows.map((m) => m.id),
        )
        .then(({ data, error: mrError }) => {
          if (mrError) throw mrError;
          return (data ?? []) as MemberRole[];
        }),
    ]);

    const roleById = new Map<string, Role>(roles.map((r) => [r.id, r]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));

    return rows.map((member) => ({
      ...member,
      profile: profileById.get(member.user_id) ?? null,
      roles: memberRoles
        .filter((mr) => mr.member_id === member.id)
        .map((mr) => roleById.get(mr.role_id))
        .filter((r): r is Role => Boolean(r))
        .sort((a, b) => b.position - a.position),
    }));
  },

  async getMyMembership(serverId: string, userId: string): Promise<ServerMember | null> {
    const { data, error } = await supabase
      .from("server_members")
      .select("*")
      .eq("server_id", serverId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as ServerMember) ?? null;
  },

  async updateNickname(memberId: string, nickname: string | null) {
    const { error } = await supabase
      .from("server_members")
      .update({ nickname: nickname?.trim() || null })
      .eq("id", memberId);
    if (error) throw error;
  },

  async leave(memberId: string) {
    const { error } = await supabase.from("server_members").delete().eq("id", memberId);
    if (error) throw error;
  },
};
