import { useEffect, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { useGlobalPresence } from "@/hooks/use-global-presence";
import { gameElapsed } from "@/services/desktop-activity";
import { cn } from "@/lib/utils";
export function LiveGameActivity({
  userId,
  className,
}: {
  userId?: string | null | undefined;
  className?: string | undefined;
}) {
  const { games } = useGlobalPresence();
  const game = games[userId ?? ""];
  const startedAt = game?.startedAt;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!game) return null;
  return (
    <p
      className={cn("text-primary flex min-w-0 items-center gap-1.5 text-xs", className)}
      title={"Jogando " + game.name + " " + gameElapsed(game.startedAt, now)}
    >
      <Gamepad2 className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        Jogando {game.name} · {gameElapsed(game.startedAt, now)}
      </span>
    </p>
  );
}
