import { IllustratedFrame } from "./IllustratedFrame";
import { isIllustratedFrame } from "@/lib/illustrated-frames";
import { profileCosmetic } from "@/lib/profile-cosmetics";
import { isAnimeFrame } from "@/lib/anime-frame-themes";
import { AnimeFrame } from "./AnimeFrame";
import { FlamingCutFrame } from "./FlamingCutFrame";

/** Decorative overlay never intercepts profile or menu interactions. */
export function ProfileFrameDecoration({
  value,
  animated = true,
  compact = false,
}: {
  value: unknown;
  animated?: boolean;
  compact?: boolean;
}) {
  const item = profileCosmetic(value);
  if (item.id === "none") return null;
  if (item.id === "flaming-cut") return <FlamingCutFrame animated={animated} />;
  if (isIllustratedFrame(item.id))
    return <IllustratedFrame theme={item.id} animated={animated} compact={compact} />;
  if (isAnimeFrame(item.id)) return <AnimeFrame theme={item.id} animated={animated} />;
  return null;
}
