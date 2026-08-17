import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-border bg-background-secondary/70 px-3 py-2 text-base transition-all duration-150 placeholder:text-muted-foreground hover:border-border-hover focus-visible:outline-none focus-visible:border-border-active focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-primary)_16%,transparent)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
