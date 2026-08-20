import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserStatus } from "@/types";

export interface ProfileUpdate {
  display_name?: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  custom_status?: string | null;
  status?: UserStatus;
}

/** Only these columns can ever be written from the client. Username is permanent. */
function sanitize(update: ProfileUpdate): ProfileUpdate {
  const clean: ProfileUpdate = {};
  if (update.display_name !== undefined) clean.display_name = update.display_name.trim();
  if (update.avatar_url !== undefined) clean.avatar_url = update.avatar_url?.trim() || null;
  if (update.banner_url !== undefined) clean.banner_url = update.banner_url?.trim() || null;
  if (update.bio !== undefined) clean.bio = update.bio?.trim() || null;
  if (update.custom_status !== undefined)
    clean.custom_status = update.custom_status?.trim() || null;
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
