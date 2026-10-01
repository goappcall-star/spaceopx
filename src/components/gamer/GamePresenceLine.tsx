import { useGlobalPresence } from "@/hooks/use-global-presence";
import { LiveGameActivity } from "./LiveGameActivity";
import { Gamepad2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { GamePresence } from "@/types";

/** Renders "🎮 Jogando <game>" — used in member list and profile card. */
export function GamePresenceLine({
  userId,
  presence,
  className,
  withLabel = false,
}: {
  userId?: string | undefined;
  presence: GamePresence | null | undefined;
  className?: string;
  withLabel?: boolean;
}) {
  const { games } = useGlobalPresence();
  const id = userId ?? presence?.user_id;
  if (games[id ?? ""]) return <LiveGameActivity userId={id} className={className} />;
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
