import { useEffect, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProfileSettingsView } from "@/components/settings/ProfileSettingsView";
import { profileDraft } from "@/lib/profile-editor";
import type { UserBadge } from "@/types";

const fixture = profileDraft({
  display_name: "Nicooo",
  bio: '"THE CREATOR"',
  avatar_url: "/lobbyx-logo.png",
  banner_url: "/auth/lobbyx-city-v1.webp",
  avatar_frame: "royal",
  nameplate: "royal",
  profile_frame: "royal",
});
const badges: UserBadge[] = ["FIRST_SERVER", "FOUNDER", "FIRST_MESSAGE"].map((slug, index) => ({
  id: String(index),
  user_id: "fixture",
  badge_id: slug,
  awarded_at: "2026-10-22T00:00:00Z",
  badge: {
    id: slug,
    name: ["Primeiro servidor", "Fundador", "Primeira mensagem"][index],
    slug,
    description: "Exemplo fictício na prévia local",
    icon_url: null,
    rarity: "epic",
    created_at: "2026-10-22T00:00:00Z",
  },
}));
export function ProfilePreview({ onBack }: { onBack: () => void }) {
  const [initial, setInitial] = useState(fixture);
  const [urls] = useState(() => new Set<string>());
  useEffect(
    () => () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    },
    [urls],
  );
  return (
    <TooltipProvider>
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-10 lg:px-14">
        <h1 className="mb-6 text-2xl font-semibold">Perfil</h1>
        <ProfileSettingsView
          initial={initial}
          username="nico"
          xp={{ level: 3, current: 0, need: 300, percent: 0 }}
          badges={badges}
          onSave={async (draft, files) => {
            const result = { ...draft };
            for (const kind of ["avatar", "banner"] as const) {
              if (files[kind]) {
                const url = URL.createObjectURL(files[kind]);
                urls.add(url);
                result[`${kind}_url`] = url;
              }
            }
            setInitial(result);
            return result;
          }}
          onCancel={onBack}
          notice={
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>PRÉVIA LOCAL · PERFIL FICTÍCIO · alterações apenas em memória</span>
              <button type="button" className="text-primary underline" onClick={onBack}>
                Voltar à prévia
              </button>
            </div>
          }
        />
      </div>
    </TooltipProvider>
  );
}
