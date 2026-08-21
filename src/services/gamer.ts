import { supabase } from "@/integrations/supabase/client";
import type {
  Badge,
  FavoriteGame,
  Game,
  GamePresence,
  GamePresenceStatus,
  Profile,
  UserBadge,
  UserPreferences,
  UserXp,
} from "@/types";

export const MAX_FAVORITE_GAMES = 5;

/* ------------------------------------------------------------------ XP math */

/** Single source of truth for progression — mirrors public.xp_for_level. */
export function xpForLevel(level: number): number {
  return 100 * Math.max(level, 1);
}

export function levelProgress(xp: number, level: number) {
  const safeXp = Math.max(xp, 0);
  let consumed = 0;
  for (let l = 1; l < Math.max(level, 1); l += 1) consumed += xpForLevel(l);
  const need = xpForLevel(level);
  const current = Math.max(safeXp - consumed, 0);
  return { current, need, percent: Math.min(100, Math.round((current / need) * 100)) };
}

/* ------------------------------------------------------------------- Games */

export const gamesService = {
  async list(): Promise<Game[]> {
    const { data, error } = await supabase.from("games").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Game[];
  },
};

/* --------------------------------------------------------- Favorite games */

export const favoriteGamesService = {
  async listByUser(userId: string): Promise<FavoriteGame[]> {
    const { data, error } = await supabase
      .from("user_favorite_games")
      .select("*, game:games(*)")
      .eq("user_id", userId)
      .order("position");
    if (error) throw error;
    return (data ?? []) as unknown as FavoriteGame[];
  },

  async add(userId: string, gameId: string, position: number) {
    const { error } = await supabase
      .from("user_favorite_games")
      .insert({ user_id: userId, game_id: gameId, position });
    if (error) {
      if (error.message.includes("favorite_games_limit")) {
        throw new Error(`Limite de ${MAX_FAVORITE_GAMES} jogos favoritos atingido.`);
      }
      throw error;
    }
  },

  async remove(id: string) {
    const { error } = await supabase.from("user_favorite_games").delete().eq("id", id);
    if (error) throw error;
  },

  /** Persists the new visual order (client already reordered the array). */
  async reorder(ids: string[]) {
    await Promise.all(
      ids.map((id, index) =>
        supabase
          .from("user_favorite_games")
          .update({ position: index })
          .eq("id", id)
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
  },
};

/* ------------------------------------------------------------ Game presence */

export const gamePresenceService = {
  /** One query for every member — avoids N+1 in the member list. */
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

  async getByUser(userId: string): Promise<GamePresence | null> {
    const { data, error } = await supabase
      .from("user_game_presence")
      .select("*, game:games(*)")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as GamePresence) ?? null;
  },

  async set(userId: string, gameId: string, status: GamePresenceStatus) {
    const { error } = await supabase.from("user_game_presence").upsert(
      {
        user_id: userId,
        game_id: gameId,
        status,
        started_at: status === "playing" ? new Date().toISOString() : null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
  },

  async stop(userId: string) {
    const { error } = await supabase
      .from("user_game_presence")
      .upsert(
        { user_id: userId, game_id: null, status: "stopped", started_at: null },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  },
};

/* ---------------------------------------------------------- XP and badges */

export const progressionService = {
  /** Read-only: XP is written exclusively by SECURITY DEFINER backend functions. */
  async getXp(userId: string): Promise<UserXp> {
    const { data, error } = await supabase
      .from("user_xp")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (
      (data as unknown as UserXp) ?? {
        user_id: userId,
        xp: 0,
        level: 1,
        updated_at: new Date().toISOString(),
      }
    );
  },

  async listBadges(userId: string): Promise<UserBadge[]> {
    const { data, error } = await supabase
      .from("user_badges")
      .select("*, badge:badges(*)")
      .eq("user_id", userId)
      .order("awarded_at");
    if (error) throw error;
    return (data ?? []) as unknown as UserBadge[];
  },

  async listAllBadges(): Promise<Badge[]> {
    const { data, error } = await supabase.from("badges").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as unknown as Badge[];
  },
};

/* --------------------------------------------------------------- Preferences */

const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id" | "updated_at"> = {
  accent_color: "neon_cyan",
  glow_enabled: true,
  animations_enabled: true,
  sounds_enabled: false,
  transparency_level: "medium",
  input_device_id: null,
  output_device_id: null,
  input_volume: 100,
  output_volume: 100,
  input_mode: "open",
  ptt_key: "KeyV",
};

export const preferencesService = {
  async get(userId: string): Promise<UserPreferences> {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (
      (data as unknown as UserPreferences) ?? {
        user_id: userId,
        ...DEFAULT_PREFERENCES,
        updated_at: new Date().toISOString(),
      }
    );
  },

  /** Only whitelisted, enum-checked values reach the database — never raw CSS. */
  async save(userId: string, update: Partial<Omit<UserPreferences, "user_id" | "updated_at">>) {
    // Merge onto the stored row so unrelated sections (visual vs audio) are never wiped.
    const current = await this.get(userId);
    const { user_id: _ignored, updated_at: _updated, ...stored } = current;
    const { error } = await supabase
      .from("user_preferences")
      .upsert(
        { user_id: userId, ...DEFAULT_PREFERENCES, ...stored, ...update },
        { onConflict: "user_id" },
      );
    if (error) throw error;
  },
};

/* ------------------------------------------------------------- Public profile */

export interface SharedServer {
  id: string;
  name: string;
  icon_url: string | null;
}

export interface PublicProfile {
  profile: Profile;
  favorites: FavoriteGame[];
  presence: GamePresence | null;
  xp: UserXp;
  badges: UserBadge[];
  sharedServers: SharedServer[];
}

export const publicProfileService = {
  async load(userId: string): Promise<PublicProfile | null> {
    const [{ data: profile, error }, favorites, presence, xp, badges, shared] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      favoriteGamesService.listByUser(userId),
      gamePresenceService.getByUser(userId),
      progressionService.getXp(userId),
      progressionService.listBadges(userId),
      supabase
        .from("server_members")
        .select("server:servers(id, name, icon_url)")
        .eq("user_id", userId)
        .then(({ data, error: sErr }) => {
          if (sErr) throw sErr;
          return ((data ?? []) as unknown as { server: SharedServer | null }[])
            .map((r) => r.server)
            .filter((s): s is SharedServer => Boolean(s));
        }),
    ]);
    if (error) throw error;
    if (!profile) return null;
    return {
      profile: profile as unknown as Profile,
      favorites,
      presence: presence && presence.status === "playing" ? presence : null,
      xp,
      badges,
      sharedServers: shared,
    };
  },
};
