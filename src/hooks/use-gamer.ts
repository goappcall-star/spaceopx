import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  favoriteGamesService,
  gamePresenceService,
  gamesService,
  preferencesService,
  progressionService,
  publicProfileService,
} from "@/services/gamer";

export function useGames() {
  return useQuery({ queryKey: ["games"], queryFn: gamesService.list, staleTime: 5 * 60 * 1000 });
}

export function useFavoriteGames(userId: string | undefined) {
  return useQuery({
    queryKey: ["favorite-games", userId],
    queryFn: () => favoriteGamesService.listByUser(userId!),
    enabled: Boolean(userId),
  });
}

export function useMyGamePresence(userId: string | undefined) {
  return useQuery({
    queryKey: ["game-presence", userId],
    queryFn: () => gamePresenceService.getByUser(userId!),
    enabled: Boolean(userId),
  });
}

/**
 * One batched query for the whole member list plus a realtime subscription —
 * no polling and no per-member request.
 */
export function useGamePresenceMap(userIds: string[]) {
  const queryClient = useQueryClient();
  const key = [...userIds].sort().join(",");

  const query = useQuery({
    queryKey: ["game-presence-map", key],
    queryFn: () => gamePresenceService.listByUsers(userIds),
    enabled: userIds.length > 0,
  });

  useEffect(() => {
    if (userIds.length === 0) return;
    const channel = supabase
      .channel(`game-presence:${key.slice(0, 40)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_game_presence" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["game-presence-map", key] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [key, queryClient, userIds.length]);

  return query.data ?? {};
}

export function useUserXp(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-xp", userId],
    queryFn: () => progressionService.getXp(userId!),
    enabled: Boolean(userId),
  });
}

export function useUserBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-badges", userId],
    queryFn: () => progressionService.listBadges(userId!),
    enabled: Boolean(userId),
  });
}

export function usePreferences(userId: string | undefined) {
  return useQuery({
    queryKey: ["preferences", userId],
    queryFn: () => preferencesService.get(userId!),
    enabled: Boolean(userId),
  });
}

export function usePublicProfile(userId: string | null) {
  return useQuery({
    queryKey: ["public-profile", userId],
    queryFn: () => publicProfileService.load(userId!),
    enabled: Boolean(userId),
  });
}
