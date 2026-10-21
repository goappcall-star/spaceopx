import type { ReactNode } from "react";
import { appearanceStyle } from "@/lib/community-appearance";
import type { Appearance } from "@/types/community-evolution";
export function CommunityIdentity({
  appearance: a,
  name,
  children,
}: {
  appearance: Appearance;
  name: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={appearanceStyle(a)}
      className={
        "relative isolate overflow-hidden rounded-2xl border p-5 " +
        (a.frame ? "border-primary" : "border-border")
      }
    >
      <CommunityBanner appearance={a} />
      <div className="relative flex flex-wrap items-center gap-3">
        <img src="/lobbyx-logo.png" alt="LobbyX" className="h-10 w-10" />
        <h3 className="font-semibold">{name}</h3>
        <CommunitySeal appearance={a} />
      </div>
      <div className="relative mt-3 text-sm text-muted-foreground">
        {children ?? "Prévia da identidade da comunidade"}
      </div>
      {a.highlight && <div className="relative mt-4 h-1 w-16 rounded-full bg-secondary" />}
    </div>
  );
}
export function CommunityBanner({ appearance: a }: { appearance: Appearance }) {
  return a.banner === "grid_banner" ? (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-30"
      style={{
        backgroundImage:
          "linear-gradient(135deg,transparent 45%,oklch(0.72 0.20 300 / .55) 46%,transparent 48%),linear-gradient(35deg,transparent 40%,oklch(0.80 0.22 125 / .25) 41%,transparent 43%)",
        backgroundSize: "120px 90px",
      }}
    />
  ) : null;
}
export function CommunitySeal({ appearance: a }: { appearance: Appearance }) {
  return a.seal === "foundation_seal" ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/80 px-2 py-1 text-xs text-primary">
      <svg width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="Selo de fundação">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" />
        <path d="M12 5 14 10 19 12 14 14 12 19 10 14 5 12 10 10Z" fill="currentColor" />
      </svg>
      Fundação
    </span>
  ) : null;
}
