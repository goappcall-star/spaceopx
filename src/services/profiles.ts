import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserStatus } from "@/types";

export interface ProfileUpdate {
  username?: string;
  display_name?: string;
  avatar_url?: string | null;
  status?: UserStatus;
}

/** Only these columns can ever be written from the client. */
function sanitize(update: ProfileUpdate): ProfileUpdate {
  const clean: ProfileUpdate = {};
  if (update.username !== undefined) clean.username = update.username.trim().toLowerCase();
  if (update.display_name !== undefined) clean.display_name = update.display_name.trim();
  if (update.avatar_url !== undefined) clean.avatar_url = update.avatar_url?.trim() || null;
  if (update.status !== undefined) clean.status = update.status;
  return clean;
}

export const profilesService = {
  async getById(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as Profile) ?? null;
  },

  async listByIds(userIds: string[]): Promise<Profile[]> {
    if (userIds.length === 0) return [];
    const { data, error } = await supabase.from("profiles").select("*").in("id", userIds);
    if (error) throw error;
    return (data ?? []) as Profile[];
  },

  async update(userId: string, update: ProfileUpdate): Promise<Profile> {
    const { data, error } = await supabase
      .from("profiles")
      .update(sanitize(update))
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Profile;
  },
};
