import { measureOperation } from "@/services/performance/monitor";
import { supabase } from "@/integrations/supabase/client";
export interface UnreadCounts {
  server_id: string;
  channel_id: string;
  unread_count: number;
  mention_count: number;
}
async function rpc(name: string, args?: Record<string, string | null>) {
  const client = supabase as unknown as {
    rpc(
      name: string,
      args?: Record<string, string | null>,
    ): PromiseLike<{ data: unknown; error: Error | null }>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}
export const unreadService = {
  async list(): Promise<UnreadCounts[]> {
    const finish = measureOperation("backend.unread");
    try {
      const result = (((await rpc("get_server_unread_counts")) as UnreadCounts[]) ?? []).map(
        (row) => ({
          ...row,
          unread_count: Number(row.unread_count),
          mention_count: Number(row.mention_count),
        }),
      );
      finish();
      return result;
    } catch (error) {
      finish(true);
      throw error;
    }
  },
  async markChannel(channelId: string, messageId: string | null) {
    await rpc("mark_channel_read_through", { _channel_id: channelId, _message_id: messageId });
  },
  async markConversation(conversationId: string, messageId: string) {
    await rpc("mark_conversation_read_through", {
      _conversation_id: conversationId,
      _message_id: messageId,
    });
  },
};
