import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import type {
  Attachment,
  ChannelReadState,
  Message,
  MessageReaction,
  MessageWithMeta,
  Profile,
  ReactionGroup,
} from "@/types";

export const MESSAGE_PAGE_SIZE = 30;

function toMessage(row: Record<string, unknown>): Message {
  return {
    ...(row as unknown as Message),
    attachments: (row.attachments as Attachment[] | null) ?? [],
    mentions: (row.mentions as string[] | null) ?? [],
  };
}

function groupReactions(rows: MessageReaction[], userId: string | undefined): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const row of rows) {
    const entry = map.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
    entry.count += 1;
    if (row.user_id === userId) entry.mine = true;
    map.set(row.emoji, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export const messagesService = {
  /** Cursor pagination: pass the created_at of the oldest loaded message. */
  async list(channelId: string, before?: string): Promise<Message[]> {
    let query = supabase
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    if (before) query = query.lt("created_at", before);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toMessage).reverse();
  },

  async getById(id: string): Promise<Message | null> {
    const { data, error } = await supabase.from("messages").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toMessage(data) : null;
  },

  async send(input: {
    channelId: string;
    content: string;
    replyToId?: string | null;
    attachments?: Attachment[];
    mentions?: string[];
  }): Promise<Message> {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        channel_id: input.channelId,
        author_id: (await supabase.auth.getUser()).data.user?.id as string,
        content: input.content.trim(),
        reply_to_id: input.replyToId ?? null,
        attachments: (input.attachments ?? []) as never,
        mentions: input.mentions ?? [],
      })
      .select("*")
      .single();
    if (error) throw error;
    return toMessage(data);
  },

  async edit(id: string, content: string): Promise<Message> {
    const { data, error } = await supabase
      .from("messages")
      .update({ content: content.trim(), edited_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toMessage(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) throw error;
  },

  async listReactions(messageIds: string[]): Promise<MessageReaction[]> {
    if (messageIds.length === 0) return [];
    const { data, error } = await supabase
      .from("message_reactions")
      .select("*")
      .in("message_id", messageIds);
    if (error) throw error;
    return (data ?? []) as MessageReaction[];
  },

  async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const { error } = await supabase
      .from("message_reactions")
      .insert({ message_id: messageId, user_id: userId, emoji });
    if (error && error.code !== "23505") throw error;
  },

  async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  },

  /** Joins authors, reply previews and grouped reactions for the UI. */
  async hydrate(
    messages: Message[],
    userId: string | undefined,
    knownProfiles: Map<string, Profile> = new Map(),
  ): Promise<MessageWithMeta[]> {
    if (messages.length === 0) return [];

    const missingIds = [...new Set(messages.map((m) => m.author_id))].filter(
      (id) => !knownProfiles.has(id),
    );
    const fetched = await profilesService.listByIds(missingIds);
    const profiles = new Map(knownProfiles);
    for (const p of fetched) profiles.set(p.id, p);

    const replyIds = [...new Set(messages.map((m) => m.reply_to_id).filter(Boolean))] as string[];
    const replyMap = new Map<string, Message>();
    if (replyIds.length > 0) {
      const { data } = await supabase.from("messages").select("*").in("id", replyIds);
      for (const row of data ?? []) replyMap.set(row.id, toMessage(row));
    }

    const reactionRows = await messagesService.listReactions(messages.map((m) => m.id));
    const byMessage = new Map<string, MessageReaction[]>();
    for (const row of reactionRows) {
      byMessage.set(row.message_id, [...(byMessage.get(row.message_id) ?? []), row]);
    }

    return messages.map((message) => {
      const reply = message.reply_to_id ? (replyMap.get(message.reply_to_id) ?? null) : null;
      return {
        ...message,
        author: profiles.get(message.author_id) ?? null,
        reactions: groupReactions(byMessage.get(message.id) ?? [], userId),
        replyTo: reply
          ? {
              id: reply.id,
              content: reply.content,
              author: profiles.get(reply.author_id) ?? null,
            }
          : null,
      };
    });
  },
};

export const readStatesService = {
  async listMine(channelIds: string[]): Promise<ChannelReadState[]> {
    if (channelIds.length === 0) return [];
    const { data, error } = await supabase
      .from("channel_read_states")
      .select("*")
      .in("channel_id", channelIds);
    if (error) throw error;
    return (data ?? []) as ChannelReadState[];
  },

  async markRead(channelId: string, userId: string, messageId: string | null): Promise<void> {
    const { error } = await supabase.from("channel_read_states").upsert(
      {
        channel_id: channelId,
        user_id: userId,
        last_read_message_id: messageId,
        last_read_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "channel_id,user_id" },
    );
    if (error) throw error;
  },
};

export { groupReactions };
