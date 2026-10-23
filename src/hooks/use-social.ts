import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  blocksService,
  conversationsService,
  friendsService,
  peopleService,
  socialPresenceService,
} from "@/services/social";

/** Friends, pending requests and their game presence. */
export function useFriends(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [subscription, setSubscription] = useState({ userId, ready: false });
  const realtimeReady = subscription.userId === userId && subscription.ready;

  const query = useQuery({
    queryKey: ["friends", userId],
    queryFn: () => friendsService.load(userId!, false),
    enabled: Boolean(userId),
    // Reconcile missed events and unavailable sockets only while the app is visible.
    refetchInterval: realtimeReady ? 15_000 : 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    retry: 1,
  });
  const friendIds = (query.data?.friends ?? []).map((friend) => friend.profile.id).sort();
  const friendIdsKey = friendIds.join(",");
  const friendIdsRef = useRef(friendIds);
  friendIdsRef.current = friendIds;
  const presence = useQuery({
    queryKey: ["friend-game-presence", userId, friendIdsKey],
    queryFn: () => socialPresenceService.listByUsers(friendIdsKey.split(",").filter(Boolean)),
    enabled: Boolean(userId && friendIdsKey),
  });

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      void queryClient.invalidateQueries({ queryKey: ["friends", userId] });
      void queryClient.invalidateQueries({ queryKey: ["relationship"] });
    };
    const channel = supabase
      .channel(`social:friendships:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${userId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_game_presence" },
        (payload) => {
          if (!alive) return;
          const id =
            (payload.new as { user_id?: string }).user_id ??
            (payload.old as { user_id?: string }).user_id;
          if (id && friendIdsRef.current.includes(id))
            void queryClient.invalidateQueries({ queryKey: ["friend-game-presence", userId] });
        },
      )
      .subscribe((status) => {
        if (!alive) return;
        setSubscription({ userId, ready: status === "SUBSCRIBED" });
        // Close the gap between the initial HTTP read and subscribing (also on reconnect).
        if (status === "SUBSCRIBED") refresh();
      });
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const friends = useMemo(
    () =>
      (query.data?.friends ?? []).map((friend) => ({
        ...friend,
        presence: presence.data?.[friend.profile.id] ?? null,
      })),
    [query.data?.friends, presence.data],
  );
  return {
    friends,
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        invalidate,
      )
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

  const conversations = useMemo(() => query.data ?? [], [query.data]);
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
