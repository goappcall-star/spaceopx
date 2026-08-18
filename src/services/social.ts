import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import { groupReactions } from "@/services/messages";
import { validateFile } from "@/services/uploads";
import type {
  Attachment,
  Conversation,
  ConversationMember,
  ConversationOverview,
  DirectMessage,
  DirectMessageWithMeta,
  FriendEntry,
  FriendRequestEntry,
  Friendship,
  GamePresence,
  MessageReaction,
  Profile,
  Relationship,
  UserBlock,
} from "@/types";

export const DM_PAGE_SIZE = 30;
export const DM_BUCKET = "dm-attachments";

/* ------------------------------------------------------------- Friendships */

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Sessão expirada.");
  return id;
}

export const friendsService = {
  async listRaw(): Promise<Friendship[]> {
    const { data, error } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Friendship[];
  },

  /** Friends + pending requests + game presence, resolved in 3 queries total. */
  async load(userId: string): Promise<{
    friends: FriendEntry[];
    requests: FriendRequestEntry[];
  }> {
    const rows = await friendsService.listRaw();
    const accepted = rows.filter((r) => r.status === "accepted");
    const pending = rows.filter((r) => r.status === "pending");

    const otherId = (r: Friendship) => (r.requester_id === userId ? r.addressee_id : r.requester_id);
    const ids = [...new Set([...accepted, ...pending].map(otherId))];
    if (ids.length === 0) return { friends: [], requests: [] };

    const [profiles, presenceMap] = await Promise.all([
      profilesService.listByIds(ids),
      socialPresenceService.listByUsers(ids),
    ]);
    const byId = new Map(profiles.map((p) => [p.id, p]));

    const friends: FriendEntry[] = accepted
      .map((r) => {
        const profile = byId.get(otherId(r));
        return profile
          ? { friendshipId: r.id, profile, presence: presenceMap[profile.id] ?? null }
          : null;
      })
      .filter(Boolean) as FriendEntry[];

    const requests: FriendRequestEntry[] = pending
      .map((r) => {
        const profile = byId.get(otherId(r));
        return profile
          ? {
              friendshipId: r.id,
              profile,
              direction: r.requester_id === userId ? ("outgoing" as const) : ("incoming" as const),
              created_at: r.created_at,
            }
          : null;
      })
      .filter(Boolean) as FriendRequestEntry[];

    return { friends, requests };
  },

  async sendRequest(addresseeId: string): Promise<string> {
    const { data, error } = await supabase.rpc("send_friend_request", { _addressee: addresseeId });
    if (error) throw error;
    return data as string;
  },

  async respond(friendshipId: string, action: "accept" | "decline" | "cancel" | "remove") {
    const { error } = await supabase.rpc("respond_friend_request", {
      _friendship_id: friendshipId,
      _action: action,
    });
    if (error) throw error;
  },

  async relationship(otherId: string): Promise<Relationship> {
    const me = await currentUserId();
    if (me === otherId) return { state: "self", friendshipId: null };

    const blocks = await blocksService.listAll();
    if (blocks.some((b) => b.blocker_id === me && b.blocked_id === otherId)) {
      return { state: "blocked_by_me", friendshipId: null };
    }
    if (blocks.some((b) => b.blocker_id === otherId && b.blocked_id === me)) {
      return { state: "blocked_me", friendshipId: null };
    }

    const rows = await friendsService.listRaw();
    const row = rows.find(
      (r) =>
        (r.requester_id === me && r.addressee_id === otherId) ||
        (r.requester_id === otherId && r.addressee_id === me),
    );
    if (!row) return { state: "none", friendshipId: null };
    if (row.status === "accepted") return { state: "friends", friendshipId: row.id };
    if (row.status === "pending") {
      return {
        state: row.requester_id === me ? "request_sent" : "request_received",
        friendshipId: row.id,
      };
    }
    return { state: "none", friendshipId: row.id };
  },
};

/* ------------------------------------------------------------------ Blocks */

export const blocksService = {
  async listAll(): Promise<UserBlock[]> {
    const { data, error } = await supabase.from("user_blocks").select("*");
    if (error) throw error;
    return (data ?? []) as UserBlock[];
  },

  async listBlockedProfiles(userId: string): Promise<Profile[]> {
    const blocks = (await blocksService.listAll()).filter((b) => b.blocker_id === userId);
    if (blocks.length === 0) return [];
    return profilesService.listByIds(blocks.map((b) => b.blocked_id));
  },

  async block(targetId: string) {
    const { error } = await supabase.rpc("block_user", { _target: targetId });
    if (error) throw error;
  },

  async unblock(targetId: string) {
    const me = await currentUserId();
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", me)
      .eq("blocked_id", targetId);
    if (error) throw error;
  },
};

/* ------------------------------------------------------------ People search */

export interface PersonSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
}

export const peopleService = {
  async search(query: string): Promise<PersonSearchResult[]> {
    if (query.trim().length < 2) return [];
    const { data, error } = await supabase.rpc("search_profiles", { _q: query });
    if (error) throw error;
    return (data ?? []) as PersonSearchResult[];
  },
};

/* ---------------------------------------------------------------- Presence */

export const socialPresenceService = {
  async listByUsers(userIds: string[]): Promise<Record<string, GamePresence>> {
    if (userIds.length === 0) return {};
    const { data, error } = await supabase
      .from("user_game_presence")
      .select("*, game:games(*)")
      .in("user_id", userIds)
      .eq("status", "playing");
    if (error) throw error;
    const map: Record<string, GamePresence> = {};
    for (const row of (data ?? []) as unknown as GamePresence[]) map[row.user_id] = row;
    return map;
  },
};

/* ----------------------------------------------------------- Conversations */

export const conversationsService = {
  /** One RPC returns every conversation with last message and unread count. */
  async listOverviews(): Promise<ConversationOverview[]> {
    const { data, error } = await supabase.rpc("list_conversation_overviews");
    if (error) throw error;
    const rows = (data ?? []) as ConversationOverview[];

    const ids = [...new Set(rows.map((r) => r.other_user_id).filter(Boolean))] as string[];
    const profiles = await profilesService.listByIds(ids);
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return rows.map((row) => ({
      ...row,
      unread_count: Number(row.unread_count ?? 0),
      member_count: Number(row.member_count ?? 0),
      otherProfile: row.other_user_id ? (byId.get(row.other_user_id) ?? null) : null,
    }));
  },

  async getById(id: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Conversation) ?? null;
  },

  async members(conversationId: string): Promise<
    (ConversationMember & { profile: Profile | null })[]
  > {
    const { data, error } = await supabase
      .from("conversation_members")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("joined_at");
    if (error) throw error;
    const rows = (data ?? []) as ConversationMember[];
    const profiles = await profilesService.listByIds(rows.map((r) => r.user_id));
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return rows.map((row) => ({ ...row, profile: byId.get(row.user_id) ?? null }));
  },

  async openDirect(otherUserId: string): Promise<string> {
    const { data, error } = await supabase.rpc("get_or_create_direct_conversation", {
      _other: otherUserId,
    });
    if (error) throw error;
    return data as string;
  },

  async createGroup(name: string, memberIds: string[]): Promise<string> {
    const { data, error } = await supabase.rpc("create_group_conversation", {
      _name: name,
      _member_ids: memberIds,
    });
    if (error) throw error;
    return data as string;
  },

  async addMember(conversationId: string, userId: string) {
    const { error } = await supabase.rpc("add_group_member", {
      _conversation_id: conversationId,
      _user_id: userId,
    });
    if (error) throw error;
  },

  async removeMember(conversationId: string, userId: string) {
    const { error } = await supabase.rpc("remove_group_member", {
      _conversation_id: conversationId,
      _user_id: userId,
    });
    if (error) throw error;
  },

  async leave(conversationId: string) {
    const { error } = await supabase.rpc("leave_group_conversation", {
      _conversation_id: conversationId,
    });
    if (error) throw error;
  },

  async rename(conversationId: string, name: string, avatarUrl?: string | null) {
    const patch: { name: string; avatar_url?: string | null } = { name: name.trim() };
    if (avatarUrl !== undefined) patch.avatar_url = avatarUrl;
    const { error } = await supabase.from("conversations").update(patch).eq("id", conversationId);
    if (error) throw error;
  },

  async markRead(conversationId: string) {
    const { error } = await supabase.rpc("mark_conversation_read", {
      _conversation_id: conversationId,
    });
    if (error) throw error;
  },
};

/* -------------------------------------------------------- Direct messages */

function toDm(row: Record<string, unknown>): DirectMessage {
  return {
    ...(row as unknown as DirectMessage),
    attachments: (row["attachments"] as Attachment[] | null) ?? [],
  };
}

export const directMessagesService = {
  async list(conversationId: string, before?: string): Promise<DirectMessage[]> {
    let query = supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(DM_PAGE_SIZE);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(toDm).reverse();
  },

  async send(input: {
    conversationId: string;
    content: string;
    replyToId?: string | null;
    attachments?: Attachment[];
  }): Promise<DirectMessage> {
    const me = await currentUserId();
    const { data, error } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: input.conversationId,
        sender_id: me,
        content: input.content.trim(),
        reply_to_id: input.replyToId ?? null,
        attachments: (input.attachments ?? []) as never,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDm(data);
  },

  async edit(id: string, content: string): Promise<DirectMessage> {
    const { data, error } = await supabase
      .from("direct_messages")
      .update({ content: content.trim(), edited_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toDm(data);
  },

  /** Soft delete keeps thread integrity for replies and future auditing. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from("direct_messages")
      .update({ deleted_at: new Date().toISOString(), content: "", attachments: [] as never })
      .eq("id", id);
    if (error) throw error;
  },

  async listReactions(messageIds: string[]): Promise<MessageReaction[]> {
    if (messageIds.length === 0) return [];
    const { data, error } = await supabase
      .from("direct_message_reactions")
      .select("*")
      .in("message_id", messageIds);
    if (error) throw error;
    return (data ?? []) as MessageReaction[];
  },

  async addReaction(messageId: string, userId: string, emoji: string) {
    const { error } = await supabase
      .from("direct_message_reactions")
      .insert({ message_id: messageId, user_id: userId, emoji });
    if (error && error.code !== "23505") throw error;
  },

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const { error } = await supabase
      .from("direct_message_reactions")
      .delete()
      .eq("message_id", messageId)
      .eq("user_id", userId)
      .eq("emoji", emoji);
    if (error) throw error;
  },

  /** Batched hydration — profiles, replies and reactions resolved in bulk. */
  async hydrate(
    messages: DirectMessage[],
    userId: string | undefined,
    knownProfiles: Map<string, Profile> = new Map(),
  ): Promise<DirectMessageWithMeta[]> {
    if (messages.length === 0) return [];

    const missing = [...new Set(messages.map((m) => m.sender_id))].filter(
      (id) => !knownProfiles.has(id),
    );
    const fetched = await profilesService.listByIds(missing);
    const profiles = new Map(knownProfiles);
    for (const p of fetched) profiles.set(p.id, p);

    const replyIds = [...new Set(messages.map((m) => m.reply_to_id).filter(Boolean))] as string[];
    const replyMap = new Map<string, DirectMessage>();
    if (replyIds.length > 0) {
      const { data } = await supabase.from("direct_messages").select("*").in("id", replyIds);
      for (const row of data ?? []) replyMap.set(row.id, toDm(row));
    }

    const reactionRows = await directMessagesService.listReactions(messages.map((m) => m.id));
    const byMessage = new Map<string, MessageReaction[]>();
    for (const row of reactionRows) {
      byMessage.set(row.message_id, [...(byMessage.get(row.message_id) ?? []), row]);
    }

    return messages.map((message) => {
      const reply = message.reply_to_id ? (replyMap.get(message.reply_to_id) ?? null) : null;
      return {
        ...message,
        author: profiles.get(message.sender_id) ?? null,
        reactions: groupReactions(byMessage.get(message.id) ?? [], userId),
        replyTo: reply
          ? {
              id: reply.id,
              content: reply.deleted_at ? "mensagem excluída" : reply.content,
              author: profiles.get(reply.sender_id) ?? null,
            }
          : null,
      };
    });
  },
};

/* --------------------------------------------------------------- Uploads */

const EXECUTABLE_EXT = /\.(exe|msi|bat|cmd|sh|ps1|com|scr|apk|jar|dll|js|vbs)$/i;

export const dmUploadsService = {
  async upload(conversationId: string, file: File): Promise<Attachment> {
    const invalid = validateFile(file);
    if (invalid) throw new Error(invalid);
    if (EXECUTABLE_EXT.test(file.name)) throw new Error("Arquivos executáveis não são permitidos.");

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${conversationId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage
      .from(DM_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;

    return {
      path,
      name: file.name,
      size: file.size,
      mime: file.type,
      kind: file.type.startsWith("image/") ? "image" : "file",
    };
  },

  async signedUrl(path: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await supabase.storage.from(DM_BUCKET).createSignedUrl(path, expiresIn);
    if (error) return null;
    return data.signedUrl;
  },
};
