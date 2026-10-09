import { supabase } from "@/integrations/supabase/client";
import type { Profile, UserStatus } from "@/types";
import { normalizeAvatarFrame, type AvatarFrameId } from "@/lib/avatar-frames";
import { validateProfileStatus } from "@/lib/profile-status";
import { boundedText, safeImageUrl } from "@/lib/input-validation.mjs";
import {
  NAMEPLATE_COSMETICS,
  normalizeProfileCosmetic,
  type ProfileCosmeticId,
} from "@/lib/profile-cosmetics";

export interface ProfileUpdate {
  nameplate?: ProfileCosmeticId;
  profile_frame?: ProfileCosmeticId;
  avatar_frame?: AvatarFrameId;
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
  if (update.nameplate !== undefined)
    clean.nameplate =
      NAMEPLATE_COSMETICS.find((item) => item.id === update.nameplate)?.id ?? "none";
  if (update.profile_frame !== undefined)
    clean.profile_frame = normalizeProfileCosmetic(update.profile_frame);
  if (update.avatar_frame !== undefined)
    clean.avatar_frame = normalizeAvatarFrame(update.avatar_frame);
  if (update.display_name !== undefined)
    clean.display_name = boundedText(update.display_name, "Nome de exibição", 60, 1);
  if (update.avatar_url !== undefined) clean.avatar_url = safeImageUrl(update.avatar_url);
  if (update.banner_url !== undefined) clean.banner_url = safeImageUrl(update.banner_url);
  if (update.bio !== undefined) clean.bio = boundedText(update.bio ?? "", "Bio", 1000) || null;
  if (update.custom_status !== undefined)
    clean.custom_status = boundedText(update.custom_status ?? "", "Status", 128) || null;
  if (update.status !== undefined) {
    validateProfileStatus(update.status);
    clean.status = update.status;
  }
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
