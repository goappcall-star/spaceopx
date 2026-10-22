import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePreferences, useUserXp, useUserBadges } from "@/hooks/use-gamer";
import { levelProgress, preferencesService } from "@/services/gamer";
import { profilesService } from "@/services/profiles";
import { profileImagesService } from "@/services/profile-images";
import {
  profileDraft,
  profileDraftUpdate,
  validateProfileDraft,
  type ProfileDraft,
  type ProfileFiles,
} from "@/lib/profile-editor";
import { profileSaveErrorMessage } from "@/lib/profile-status";
import { ProfileSettingsView } from "./ProfileSettingsView";
import { SettingsShell } from "./SettingsShell";

export function ProfileSettingsEditor() {
  const { user } = useAuth();
  return <AccountProfileEditor key={user?.id ?? "signed-out"} />;
}
function AccountProfileEditor() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const prefs = usePreferences(user?.id),
    xp = useUserXp(user?.id),
    badges = useUserBadges(user?.id);
  const active = useRef(true);
  const uploaded = useRef({
    avatar: new WeakMap<File, string>(),
    banner: new WeakMap<File, string>(),
  });
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const initial = useMemo(
    () =>
      profileDraft(profile ?? { display_name: "" }, prefs.data?.frame_animations_enabled ?? true),
    [profile, prefs.data?.frame_animations_enabled],
  );
  async function save(draft: ProfileDraft, files: ProfileFiles) {
    if (!user || !profile || !prefs.data)
      throw Error("Aguarde o carregamento do perfil e das preferências.");
    validateProfileDraft(draft, initial);
    const result = { ...draft };
    for (const kind of ["avatar", "banner"] as const) {
      const file = files[kind];
      if (!file) continue;
      if (!active.current) throw Error("A sessão foi encerrada.");
      let url = uploaded.current[kind].get(file);
      if (!url) {
        url = await profileImagesService.upload(
          kind === "avatar" ? "avatars" : "banners",
          user.id,
          file,
        );
        uploaded.current[kind].set(file, url);
      }
      result[`${kind}_url`] = url;
    }
    if (!active.current) throw Error("A sessão foi encerrada.");
    try {
      await profilesService.update(user.id, profileDraftUpdate(result));
    } catch (error) {
      throw Error(profileSaveErrorMessage(error));
    }
    try {
      if (!active.current) return result;
      if (result.frame_animations_enabled !== prefs.data.frame_animations_enabled)
        await preferencesService.save(user.id, {
          frame_animations_enabled: result.frame_animations_enabled,
        });
    } catch {
      throw Error(
        "O perfil foi salvo, mas a preferência de animações falhou. Tente salvar novamente.",
      );
    } finally {
      if (active.current) {
        await refreshProfile();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["preferences", user.id] }),
          queryClient.invalidateQueries({ queryKey: ["public-profile", user.id] }),
        ]);
      }
    }
    return result;
  }
  return (
    <SettingsShell active="profile">
      <ProfileSettingsView
        initial={initial}
        username={profile?.username ?? ""}
        xp={xp.data ? { level: xp.data.level, ...levelProgress(xp.data.xp, xp.data.level) } : null}
        badges={badges.data ?? []}
        badgesUnavailable={badges.isError}
        onSave={save}
        onCancel={() => void navigate({ to: "/app" })}
        unavailable={
          !profile || prefs.isPending
            ? "Carregando perfil e preferências..."
            : prefs.isError
              ? "Não foi possível carregar suas preferências. Reabra esta página para tentar novamente."
              : undefined
        }
      />
    </SettingsShell>
  );
}
