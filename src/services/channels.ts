import { supabase } from "@/integrations/supabase/client";
import type { Channel, ChannelType } from "@/types";

export const channelsService = {
  async update(serverId: string, id: string, name: string, description: string) {
    if (!name.trim() || name.trim().length > 80)
      throw new Error("Use um nome de 1 a 80 caracteres.");
    const { error } = await supabase
      .from("channels")
      .update({ name: name.trim(), description: description.trim() || null })
      .eq("server_id", serverId)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
  },
  async remove(serverId: string, id: string) {
    const { error } = await supabase
      .from("channels")
      .delete()
      .eq("server_id", serverId)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
  },
  async listByServer(serverId: string): Promise<Channel[]> {
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("server_id", serverId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []) as Channel[];
  },

  /** Stage 1 only creates text channels; the schema already supports the rest. */
  async create(
    serverId: string,
    name: string,
    type: ChannelType = "text",
    categoryId?: string | null,
  ): Promise<Channel> {
    const { data, error } = await supabase
      .from("channels")
      .insert({
        server_id: serverId,
        name: name.trim().toLowerCase(),
        type,
        ...(categoryId ? { category_id: categoryId } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data as Channel;
  },
};
