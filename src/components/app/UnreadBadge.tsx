import { cn } from "@/lib/utils";
export function UnreadBadge({
  count,
  className,
  title,
}: {
  count: number;
  className?: string;
  title?: string;
}) {
  if (!Number.isFinite(count) || count <= 0) return null;
  return (
    <span
      title={title ?? `${count} mensagens não lidas`}
      aria-label={title ?? `${count} mensagens não lidas`}
      className={cn(
        "pointer-events-none inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-bold text-primary-foreground ring-2 ring-surface",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
