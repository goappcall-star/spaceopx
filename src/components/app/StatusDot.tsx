import { cn } from "@/lib/utils";
import type { UserStatus } from "@/types";

const STATUS_CLASS: Record<UserStatus, string> = {
  online: "bg-success",
  idle: "bg-warning",
  dnd: "bg-destructive",
  offline: "bg-muted-foreground",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  online: "Online",
  idle: "Ausente",
  dnd: "Não perturbe",
  offline: "Offline",
};

export const STATUS_EMOJI: Record<UserStatus, string> = {
  online: "🟢",
  idle: "🌙",
  dnd: "⛔",
  offline: "⚫",
};

export function StatusDot({
  status,
  playing = false,
  className,
}: {
  status: UserStatus;
  playing?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-label={playing ? "Jogando" : STATUS_LABEL[status]}
      className={cn(
        "block h-3 w-3 rounded-full",
        playing ? "bg-primary" : STATUS_CLASS[status],
        className,
      )}
    />
  );
}
