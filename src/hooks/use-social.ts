import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  blocksService,
  conversationsService,
  friendsService,
  peopleService,
} from "@/services/social";

/** Friends, pending requests and their game presence. */
export function useFriends(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["friends", userId],
    queryFn: () => friendsService.load(userId!),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`social:friendships:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
        void queryClient.invalidateQueries({ queryKey: ["relationship"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_game_presence" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    friends: query.data?.friends ?? [],
    requests: query.data?.requests ?? [],
    isLoading: query.isLoading,
  };
}

/** Conversations with last message + unread counts, kept live by realtime. */
export function useConversations(userId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["conversations", userId],
    queryFn: () => conversationsService.listOverviews(),
    enabled: Boolean(userId),
  });

  useEffect(() => {
    if (!userId) return;
    const invalidate = () =>
      void queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    const channel = supabase
      .channel(`social:conversations:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, invalidate)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const conversations = query.data ?? [];
  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + Number(c.unread_count ?? 0), 0),
    [conversations],
  );

  return { conversations, totalUnread, isLoading: query.isLoading };
}

export function useConversationMembers(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-members", conversationId],
    queryFn: () => conversationsService.members(conversationId!),
    enabled: Boolean(conversationId),
  });
}

export function useRelationship(otherUserId: string | null) {
  return useQuery({
    queryKey: ["relationship", otherUserId],
    queryFn: () => friendsService.relationship(otherUserId!),
    enabled: Boolean(otherUserId),
  });
}

export function useBlockedProfiles(userId: string | undefined) {
  return useQuery({
    queryKey: ["blocked", userId],
    queryFn: () => blocksService.listBlockedProfiles(userId!),
    enabled: Boolean(userId),
  });
}

export function usePeopleSearch(query: string) {
  return useQuery({
    queryKey: ["people-search", query.trim()],
    queryFn: () => peopleService.search(query),
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}
