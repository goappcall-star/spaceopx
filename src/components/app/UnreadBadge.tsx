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
        "pointer-events-none inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-none font-bold text-white ring-2 ring-surface",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
