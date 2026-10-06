import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppSidebarDrawer({
  open,
  side,
  children,
}: {
  open: boolean;
  side: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute top-12 bottom-0 z-40 max-w-full md:contents",
        side === "left"
          ? "left-0 max-md:[&>aside:last-child]:w-[calc(100vw-76px)]"
          : "right-0 overflow-y-auto bg-surface max-md:[&>aside]:!flex [&>aside]:h-full",
        open ? "flex" : "hidden",
      )}
    >
      {children}
    </div>
  );
}
