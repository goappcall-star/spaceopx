import { Gamepad2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="bg-brand-gradient relative flex h-10 w-10 items-center justify-center rounded-2xl shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-primary)_35%,transparent),0_10px_26px_-12px_color-mix(in_oklab,var(--color-primary)_95%,transparent)]">
        <span
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent_55%)]"
        />
        <Gamepad2 className="text-primary-foreground relative h-5 w-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Lobby<span className="text-brand-gradient">X</span>
        </span>
      )}
    </div>
  );
}
