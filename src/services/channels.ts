import { supabase } from "@/integrations/supabase/client";
import type { Channel, ChannelType } from "@/types";

export const channelsService = {
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
  async create(serverId: string, name: string, type: ChannelType = "text"): Promise<Channel> {
    const { data, error } = await supabase
      .from("channels")
      .insert({ server_id: serverId, name: name.trim().toLowerCase(), type })
      .select("*")
      .single();
    if (error) throw error;
    return data as Channel;
  },
};
