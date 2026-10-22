import { normalizeAvatarFrame, type AvatarFrameId } from "./avatar-frames";
import { normalizeProfileCosmetic, type ProfileCosmeticId } from "./profile-cosmetics";

export interface ProfileDraft {
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  avatar_frame: AvatarFrameId;
  nameplate: ProfileCosmeticId;
  profile_frame: ProfileCosmeticId;
  frame_animations_enabled: boolean;
}
export interface ProfileFiles {
  avatar: File | null;
  banner: File | null;
}
export function profileDraft(
  profile: {
    display_name: string;
    bio?: string | null;
    avatar_url?: string | null;
    banner_url?: string | null;
    avatar_frame?: unknown;
    nameplate?: unknown;
    profile_frame?: unknown;
  },
  animations = true,
): ProfileDraft {
  return {
    display_name: profile.display_name,
    bio: profile.bio ?? "",
    avatar_url: profile.avatar_url ?? "",
    banner_url: profile.banner_url ?? "",
    avatar_frame: normalizeAvatarFrame(profile.avatar_frame),
    nameplate: normalizeProfileCosmetic(profile.nameplate),
    profile_frame: normalizeProfileCosmetic(profile.profile_frame),
    frame_animations_enabled: animations,
  };
}
export function validateProfileDraft(next: ProfileDraft, saved: ProfileDraft) {
  if (!next.display_name.trim()) throw Error("Informe um nome de exibição.");
  // Never truncate older saved text just because a cosmetic was changed.
  if (next.display_name !== saved.display_name && Array.from(next.display_name).length > 32)
    throw Error("Use até 32 caracteres no nome de exibição.");
  if (next.bio !== saved.bio && Array.from(next.bio).length > 160)
    throw Error("Use até 160 caracteres na bio.");
}
export function sameProfileDraft(a: ProfileDraft, b: ProfileDraft) {
  return (Object.keys(a) as (keyof ProfileDraft)[]).every((key) => a[key] === b[key]);
}
/** Whitelist excludes username and both presence/status fields. */
export function profileDraftUpdate(next: ProfileDraft) {
  return {
    display_name: next.display_name.trim(),
    bio: next.bio,
    avatar_url: next.avatar_url || null,
    banner_url: next.banner_url || null,
    avatar_frame: next.avatar_frame,
    nameplate: next.nameplate,
    profile_frame: next.profile_frame,
  };
}
