import { useState, type ReactNode } from "react";
import { Image, Info, AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "./community-ui.css";

export function CommunityHeading({
  title,
  description,
  icon: Icon,
  eyebrow,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="community-heading">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="community-icon">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="community-eyebrow">{eyebrow}</p>}
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </header>
  );
}
export function CommunitySection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("community-section", className)}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
export function CommunityNotice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  const Icon = tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "community-notice",
        tone === "error" && "community-notice-error",
        tone === "success" && "community-notice-success",
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
export function CommunityCover({
  src,
  title,
  description,
  children,
  compact = false,
}: {
  src?: string | null;
  title: string;
  description?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  let safe = false;
  if (src && !/[\s\\]/.test(src)) {
    try {
      const url = new URL(src, "https://lobbyx.invalid");
      const local = src.startsWith("/") && !src.startsWith("//");
      safe =
        (local || /^https:\/\//i.test(src)) &&
        url.protocol === "https:" &&
        !url.username &&
        !url.password;
    } catch {
      // An incomplete draft uses the placeholder until it is a valid image URL.
    }
  }
  return (
    <div className="community-cover">
      <div className={cn("community-cover-image", compact && "community-cover-compact")}>
        {src && safe && failed !== src ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(src)}
          />
        ) : (
          <div className="community-cover-placeholder">
            <Image aria-hidden="true" className="h-7 w-7" />
            <span>
              {src && failed === src
                ? "Não foi possível carregar a capa"
                : "Identidade da comunidade"}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="break-words text-lg font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
export function CommunityActions({ children }: { children: ReactNode }) {
  return <footer className="community-actions">{children}</footer>;
}
export function CommunityEmpty({
  title,
  description,
  icon: Icon = Info,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="community-empty">
      <Icon aria-hidden="true" className="mb-3 h-6 w-6 text-primary" />
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
