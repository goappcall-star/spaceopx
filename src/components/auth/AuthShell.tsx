import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import "./auth-scenic.css";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  layout?: "classic" | "scenic";
}

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  layout = "classic",
}: AuthShellProps) {
  if (layout === "scenic") {
    return (
      <main className="auth-scenic">
        <div className="auth-scenic-layout">
          <section className="auth-scenic-brand" aria-label="LobbyX">
            <img src="/lobbyx-logo.png" alt="" aria-hidden="true" className="auth-scenic-logo" />
            <div className="auth-scenic-wordmark" aria-hidden="true">
              Lobby<span>X</span>
            </div>
            <p>
              Mais que conversas.
              <br />
              Comunidades vivas.
            </p>
            <span className="auth-scenic-accent" aria-hidden="true" />
          </section>
          <section className="auth-scenic-card" aria-labelledby="auth-title">
            <div className="auth-scenic-heading">
              <h1 id="auth-title">
                {title.endsWith("LobbyX") ? (
                  <>
                    {title.slice(0, -1)}
                    <span className="auth-heading-x">X</span>
                  </>
                ) : (
                  title
                )}
              </h1>
              <p>{subtitle}</p>
            </div>
            {children}
            {footer && <div className="auth-scenic-footer">{footer}</div>}
          </section>
        </div>
      </main>
    );
  }
  return (
    <main className="bg-hero-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="panel shadow-panel p-7">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="text-muted-foreground mt-6 text-center text-sm">{footer}</div>}
      </div>
    </main>
  );
}
