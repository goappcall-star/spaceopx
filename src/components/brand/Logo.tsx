import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img
        src="/lobbyx-logo.png"
        alt={compact ? "LobbyX" : ""}
        className="h-10 w-10 shrink-0 rounded-xl object-contain"
      />
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Lobby<span className="text-brand-gradient">X</span>
        </span>
      )}
    </div>
  );
}
