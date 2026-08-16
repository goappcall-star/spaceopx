import { Gamepad2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GamePresence } from "@/types";

/** Renders "🎮 Jogando <game>" — used in member list and profile card. */
export function GamePresenceLine({
  presence,
  className,
  withLabel = false,
}: {
  presence: GamePresence | null | undefined;
  className?: string;
  withLabel?: boolean;
}) {
  if (!presence || presence.status !== "playing" || !presence.game) return null;

  return (
    <p className={cn("text-primary flex min-w-0 items-center gap-1.5 text-xs", className)}>
      {presence.game.icon_url ? (
        <img src={presence.game.icon_url} alt="" className="h-3.5 w-3.5 rounded-sm" />
      ) : (
        <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="truncate">
        {withLabel ? "Jogando " : ""}
        {presence.game.name}
      </span>
    </p>
  );
}
