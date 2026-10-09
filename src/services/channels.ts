import { supabase } from "@/integrations/supabase/client";
import type { Channel, ChannelType } from "@/types";
import { boundedText } from "@/lib/input-validation.mjs";

export const channelsService = {
  async update(serverId: string, id: string, name: string, description: string) {
    const { error } = await supabase
      .from("channels")
      .update({
        name: boundedText(name, "Nome do canal", 60, 1),
        description: boundedText(description, "Descrição", 1000) || null,
      })
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
    isAfk = false,
  ): Promise<Channel> {
    const { data, error } = await supabase
      .from("channels")
      .insert({
        server_id: serverId,
        name: boundedText(name, "Nome do canal", 60, 1).toLowerCase(),
        type,
        ...(isAfk ? { is_afk: true } : {}),
        ...(categoryId ? { category_id: categoryId } : {}),
      })
      .select("*")
      .single();
    if (error) {
      if (isAfk && error.code === "23505") throw new Error("Este servidor já possui um canal AFK.");
      throw error;
    }
    return data as Channel;
  },
};
