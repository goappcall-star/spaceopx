import { supabase } from "@/integrations/supabase/client";
import type { Server, ServerInteractions, ServerVisibility } from "@/types";

export interface CreateServerInput {
  name: string;
  description?: string;
  iconUrl?: string;
}

export const DEFAULT_INTERACTIONS: ServerInteractions = {
  allow_messages: true,
  allow_reactions: true,
  allow_mentions: true,
  allow_member_invites: false,
  allow_member_dms: true,
};

/** The DB stores `interactions` as free-form JSONB; normalise it for the UI. */
export function toServer(row: Record<string, unknown>): Server {
  const raw = (row["interactions"] ?? {}) as Partial<ServerInteractions>;
  return {
    ...(row as unknown as Server),
    visibility: (row["visibility"] as ServerVisibility) ?? "private",
    interactions: { ...DEFAULT_INTERACTIONS, ...raw },
  };
}

export const serversService = {
  /** RLS only returns servers the current user is a member of. */
  async listMine(): Promise<Server[]> {
    const { data, error } = await supabase
      .from("servers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toServer);
  },

  async getById(serverId: string): Promise<Server | null> {
    const { data, error } = await supabase
      .from("servers")
      .select("*")
      .eq("id", serverId)
      .maybeSingle();
    if (error) throw error;
    return data ? toServer(data) : null;
  },

  /** Transactional: server + OWNER/ADMIN/MEMBER roles + membership + #geral. */
  async create({ name, description, iconUrl }: CreateServerInput): Promise<string> {
    const args: { _name: string; _description?: string; _icon_url?: string } = { _name: name };
    if (description?.trim()) args._description = description.trim();
    if (iconUrl?.trim()) args._icon_url = iconUrl.trim();
    const { data, error } = await supabase.rpc("create_server", args);
    if (error) throw error;
    return data as string;
  },

  /**
   * Writes go straight to the table: RLS (`manage_server` permission) is the
   * authorization boundary and a DB trigger records the audit entry.
   */
  async update(
    serverId: string,
    patch: Partial<
      Pick<Server, "name" | "description" | "icon_url" | "banner_url" | "visibility">
    > & { interactions?: ServerInteractions },
  ): Promise<Server> {
    const { data, error } = await supabase
      .from("servers")
      .update(patch)
      .eq("id", serverId)
      .select("*")
      .single();
    if (error) throw error;
    return toServer(data);
  },

  async remove(serverId: string) {
    const { error } = await supabase.from("servers").delete().eq("id", serverId);
    if (error) throw error;
  },
};
