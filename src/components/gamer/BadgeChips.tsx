import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { UserBadge } from "@/types";

const BADGE_EMOJI: Record<string, string> = {
  FIRST_SERVER: "🏆",
  FIRST_MESSAGE: "⭐",
  FIRST_VOICE: "🎙️",
  VETERAN: "🛡️",
  FOUNDER: "👑",
};

const RARITY_CLASS: Record<string, string> = {
  common: "border-border",
  rare: "border-primary/50",
  epic: "border-primary/70 glow-ring",
  legendary: "border-warning glow-ring",
};

export function BadgeChips({ badges }: { badges: UserBadge[] }) {
  if (badges.length === 0) {
    return <p className="text-muted-foreground text-xs">Nenhuma conquista ainda.</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((entry) => {
        const badge = entry.badge;
        const emoji = badge ? (BADGE_EMOJI[badge.slug] ?? "🎖️") : "🎖️";
        return (
          <li key={entry.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`bg-surface flex h-10 w-10 items-center justify-center rounded-xl border text-lg ${
                    RARITY_CLASS[badge?.rarity ?? "common"]
                  }`}
                >
                  {badge?.icon_url ? (
                    <img src={badge.icon_url} alt={badge.name} className="h-6 w-6" />
                  ) : (
                    <span aria-hidden>{emoji}</span>
                  )}
                  <span className="sr-only">{badge?.name}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-medium">{badge?.name}</p>
                {badge?.description && (
                  <p className="text-muted-foreground text-xs">{badge.description}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
