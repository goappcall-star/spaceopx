import { toast } from "sonner";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { MESSAGE_PAGE_SIZE, messagesService } from "@/services/messages";
import type { Attachment, Message, MessageWithMeta, Profile } from "@/types";

interface Options {
  channelId: string | null;
  serverId: string | null;
  userId: string | undefined;
  profiles: Map<string, Profile>;
  enabled: boolean;
}

/**
 * Loads a channel's history with cursor pagination and keeps it in sync through
 * a single realtime subscription that is torn down whenever the channel changes.
 */
export function useChannelMessages({ channelId, userId, profiles, enabled }: Options) {
  const [messages, setMessages] = useState<MessageWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const messagesRef = useRef<MessageWithMeta[]>([]);
  messagesRef.current = messages;

  const hydrate = useCallback(
    (rows: Message[]) => messagesService.hydrate(rows, userId, profilesRef.current),
    [userId],
  );

  // Initial load + realtime subscription, scoped to one channel at a time.
  useEffect(() => {
    if (!channelId || !enabled) {
      setMessages([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    let realtime: RealtimeChannel | null = null;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const rows = await messagesService.list(channelId);
        const hydrated = await hydrate(rows);
        if (cancelled) return;
        setMessages(hydrated);
        setHasMore(rows.length === MESSAGE_PAGE_SIZE);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const refreshReactions = async (messageId?: string) => {
      const ids = messageId ? [messageId] : messagesRef.current.map((m) => m.id);
      if (!ids.some((id) => messagesRef.current.some((m) => m.id === id))) return;
      const rows = await messagesService.listReactions(ids);
      const { groupReactions } = await import("@/services/messages");
      if (cancelled) return;
      setMessages((prev) =>
        prev.map((m) =>
          ids.includes(m.id)
            ? {
                ...m,
                reactions: groupReactions(
                  rows.filter((row) => row.message_id === m.id),
                  userId,
                ),
              }
            : m,
        ),
      );
    };

    realtime = supabase
      .channel(`channel-messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const row = payload.new as Message;
          if (messagesRef.current.some((m) => m.id === row.id)) return;
          const [hydrated] = await hydrate([row]);
          if (!hydrated) return;
          setMessages((prev) =>
            prev.some((m) => m.id === hydrated.id) ? prev : [...prev, hydrated],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    content: row.content,
                    edited_at: row.edited_at,
                    attachments: (row.attachments as Attachment[] | null) ?? m.attachments,
                  }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== old.id));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as {
            message_id?: string;
          };
          // With RLS a DELETE event can contain only the reaction primary key.
          // Refresh the loaded messages instead of leaving other clients stale.
          if (row.message_id || payload.eventType === "DELETE")
            void refreshReactions(row.message_id).catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (realtime) void supabase.removeChannel(realtime);
    };
  }, [channelId, enabled, hydrate, userId]);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!channelId || !oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await messagesService.list(channelId, oldest.created_at);
      const hydrated = await hydrate(rows);
      setMessages((prev) => [...hydrated, ...prev]);
      setHasMore(rows.length === MESSAGE_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [channelId, hydrate, loadingMore]);

  const send = useCallback(
    async (input: {
      content: string;
      replyToId?: string | null;
      attachments?: Attachment[];
      mentions?: string[];
    }) => {
      if (!channelId) return;
      const created = await messagesService.send({ channelId, ...input });
      const [hydrated] = await hydrate([created]);
      if (hydrated) {
        setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, hydrated]));
      }
    },
    [channelId, hydrate],
  );

  const edit = useCallback(async (id: string, content: string) => {
    const updated = await messagesService.edit(id, content);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: updated.content, edited_at: updated.edited_at } : m,
      ),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await messagesService.remove(id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const reactionBusy = useRef(new Set<string>());
  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId || reactionBusy.current.has(messageId)) return;
      reactionBusy.current.add(messageId);
      try {
        const message = messagesRef.current.find((m) => m.id === messageId);
        const mine = message?.reactions.find((r) => r.emoji === emoji)?.mine;
        if (mine) await messagesService.removeReaction(messageId, userId, emoji);
        else await messagesService.addReaction(messageId, userId, emoji);
        const rows = await messagesService.listReactions([messageId]);
        const { groupReactions } = await import("@/services/messages");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: groupReactions(rows, userId) } : m,
          ),
        );
      } catch {
        toast.error("Não foi possível atualizar a reação. Tente novamente.");
      } finally {
        reactionBusy.current.delete(messageId);
      }
    },
    [userId],
  );

  return {
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    loadOlder,
    send,
    edit,
    remove,
    toggleReaction,
  };
}
