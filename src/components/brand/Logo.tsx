import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl">
        <ShieldCheck className="text-primary-foreground h-5 w-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Secure<span className="text-primary">Chat</span>
        </span>
      )}
    </div>
  );
}
