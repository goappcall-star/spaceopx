import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { groupReactions } from "@/services/messages";
import { DM_PAGE_SIZE, directMessagesService } from "@/services/social";
import type { Attachment, DirectMessage, DirectMessageWithMeta, Profile } from "@/types";

interface Options {
  conversationId: string | null;
  userId: string | undefined;
  profiles: Map<string, Profile>;
}

/** Cursor-paginated DM history kept in sync by a single realtime channel. */
export function useDirectMessages({ conversationId, userId, profiles }: Options) {
  const [messages, setMessages] = useState<DirectMessageWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const messagesRef = useRef<DirectMessageWithMeta[]>([]);
  messagesRef.current = messages;

  const hydrate = useCallback(
    (rows: DirectMessage[]) => directMessagesService.hydrate(rows, userId, profilesRef.current),
    [userId],
  );

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    let realtime: RealtimeChannel | null = null;
    setLoading(true);

    void (async () => {
      try {
        const rows = await directMessagesService.list(conversationId);
        const hydrated = await hydrate(rows);
        if (cancelled) return;
        setMessages(hydrated);
        setHasMore(rows.length === DM_PAGE_SIZE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const refreshReactions = async (messageId: string) => {
      if (!messagesRef.current.some((m) => m.id === messageId)) return;
      const rows = await directMessagesService.listReactions([messageId]);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, reactions: groupReactions(rows, userId) } : m,
        ),
      );
    };

    realtime = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const row = payload.new as DirectMessage;
          if (messagesRef.current.some((m) => m.id === row.id)) return;
          const [hydrated] = await hydrate([{ ...row, attachments: row.attachments ?? [] }]);
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
          table: "direct_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as DirectMessage;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    content: row.content,
                    edited_at: row.edited_at,
                    deleted_at: row.deleted_at,
                    attachments: (row.attachments as Attachment[] | null) ?? [],
                  }
                : m,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_message_reactions" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { message_id?: string };
          if (row?.message_id) void refreshReactions(row.message_id);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (realtime) void supabase.removeChannel(realtime);
    };
  }, [conversationId, hydrate, userId]);

  const loadOlder = useCallback(async () => {
    const oldest = messagesRef.current[0];
    if (!conversationId || !oldest || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await directMessagesService.list(conversationId, oldest.created_at);
      const hydrated = await hydrate(rows);
      setMessages((prev) => [...hydrated, ...prev]);
      setHasMore(rows.length === DM_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hydrate, loadingMore]);

  const send = useCallback(
    async (input: { content: string; replyToId?: string | null; attachments?: Attachment[] }) => {
      if (!conversationId) return;
      const created = await directMessagesService.send({ conversationId, ...input });
      const [hydrated] = await hydrate([created]);
      if (hydrated) {
        setMessages((prev) => (prev.some((m) => m.id === created.id) ? prev : [...prev, hydrated]));
      }
    },
    [conversationId, hydrate],
  );

  const edit = useCallback(async (id: string, content: string) => {
    const updated = await directMessagesService.edit(id, content);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, content: updated.content, edited_at: updated.edited_at } : m,
      ),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await directMessagesService.remove(id);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, deleted_at: new Date().toISOString(), content: "", attachments: [] }
          : m,
      ),
    );
  }, []);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!userId) return;
      const message = messagesRef.current.find((m) => m.id === messageId);
      const mine = message?.reactions.find((r) => r.emoji === emoji)?.mine;
      if (mine) await directMessagesService.removeReaction(messageId, userId, emoji);
      else await directMessagesService.addReaction(messageId, userId, emoji);
    },
    [userId],
  );

  return { messages, loading, loadingMore, hasMore, loadOlder, send, edit, remove, toggleReaction };
}
