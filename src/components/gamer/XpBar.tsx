import { Zap } from "lucide-react";

import { levelProgress } from "@/services/gamer";
import { cn } from "@/lib/utils";

export function XpBar({
  xp,
  level,
  className,
}: {
  xp: number;
  level: number;
  className?: string;
}) {
  const { current, need, percent } = levelProgress(xp, level);

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-primary inline-flex items-center gap-1 font-semibold tracking-wide uppercase">
          <Zap className="h-3.5 w-3.5" />
          Level {level}
        </span>
        <span className="text-muted-foreground font-mono">
          {current} / {need} XP
        </span>
      </div>
      <div
        className="bg-muted h-2.5 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={need}
        aria-label={`Progresso do nível ${level}`}
      >
        <div
          className="bg-brand-gradient glow-soft h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
