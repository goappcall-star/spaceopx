import { supabase } from "@/integrations/supabase/client";
import type { Server } from "@/types";

export interface CreateServerInput {
  name: string;
  description?: string;
  iconUrl?: string;
}

export const serversService = {
  /** RLS only returns servers the current user is a member of. */
  async listMine(): Promise<Server[]> {
    const { data, error } = await supabase
      .from("servers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Server[];
  },

  async getById(serverId: string): Promise<Server | null> {
    const { data, error } = await supabase
      .from("servers")
      .select("*")
      .eq("id", serverId)
      .maybeSingle();
    if (error) throw error;
    return (data as Server) ?? null;
  },

  /** Transactional: server + OWNER/ADMIN/MEMBER roles + membership + #geral. */
  async create({ name, description, iconUrl }: CreateServerInput): Promise<string> {
    const { data, error } = await supabase.rpc("create_server", {
      _name: name,
      _description: description ?? null,
      _icon_url: iconUrl ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async update(serverId: string, patch: Partial<Pick<Server, "name" | "description" | "icon_url">>) {
    const { data, error } = await supabase
      .from("servers")
      .update(patch)
      .eq("id", serverId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Server;
  },

  async remove(serverId: string) {
    const { error } = await supabase.from("servers").delete().eq("id", serverId);
    if (error) throw error;
  },
};
