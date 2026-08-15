import { cn } from "@/lib/utils";
import type { UserStatus } from "@/types";

const STATUS_CLASS: Record<UserStatus, string> = {
  online: "bg-success",
  idle: "bg-warning",
  offline: "bg-muted-foreground",
};

export const STATUS_LABEL: Record<UserStatus, string> = {
  online: "Online",
  idle: "Ausente",
  offline: "Offline",
};

export function StatusDot({ status, className }: { status: UserStatus; className?: string }) {
  return (
    <span
      aria-label={STATUS_LABEL[status]}
      className={cn("block h-3 w-3 rounded-full", STATUS_CLASS[status], className)}
    />
  );
}
