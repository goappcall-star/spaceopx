import { Plus, Users } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { UnreadBadge } from "./UnreadBadge";
import type { Server } from "@/types";
import { ServerContextMenu, type ServerMenuAction } from "./ServerContextMenu";
import type { ServerPreferences } from "@/hooks/use-server-preferences";

interface Props {
  servers: Server[];
  activeServerId: string | null;
  onSelect: (serverId: string) => void;
  onHome: () => void;
  onAdd: () => void;
  socialActive: boolean;
  onSelectSocial: () => void;
  socialBadge?: number;
  serverBadges?: Record<string, number>;
  serverMentions?: Record<string, number>;
  getPreferences: (serverId: string) => ServerPreferences;
  onUpdatePreferences: (serverId: string, patch: Partial<ServerPreferences>) => void;
  onServerAction: (action: ServerMenuAction, server: Server) => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function ServerRail({
  servers,
  activeServerId,
  onSelect,
  onHome,
  onAdd,
  socialActive,
  onSelectSocial,
  socialBadge = 0,
  serverBadges = {},
  serverMentions = {},
  getPreferences,
  onUpdatePreferences,
  onServerAction,
}: Props) {
  return (
    <nav
      aria-label="Servidores"
      className="bg-rail relative z-30 flex w-[76px] shrink-0 flex-col items-center gap-2 py-3 shadow-[1px_0_0_0_var(--color-border),8px_0_28px_-24px_rgba(0,0,0,0.9)]"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onHome}
            aria-label="Início do LobbyX"
            className="group relative mb-1 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 hover:rounded-xl"
          >
            <Logo compact />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">LobbyX</TooltipContent>
      </Tooltip>

      <span className="bg-border/80 mb-1 h-px w-8 rounded-full" />

      <div className="scrollbar-slim flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-3 py-0.5">
        {servers.map((server) => {
          const active = server.id === activeServerId;
          return (
            <ServerContextMenu
              key={server.id}
              server={server}
              preferences={getPreferences(server.id)}
              onUpdate={(patch) => onUpdatePreferences(server.id, patch)}
              onAction={onServerAction}
            >
              <div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onSelect(server.id)}
                      aria-label={server.name}
                      aria-current={active ? "true" : undefined}
                      className="group relative flex h-12 w-12 items-center justify-center"
                    >
                      {/* Left activity pill */}
                      <span
                        aria-hidden
                        className={cn(
                          "absolute -left-3 w-1 rounded-r-full transition-all duration-200",
                          active
                            ? "bg-primary h-7 shadow-[0_0_12px_-1px_color-mix(in_oklab,var(--color-primary)_85%,transparent)]"
                            : "bg-foreground/45 h-0 group-hover:h-3.5",
                        )}
                      />
                      <span
                        className={cn(
                          "flex h-12 w-12 items-center justify-center overflow-hidden text-sm font-semibold transition-all duration-200",
                          active
                            ? "border-primary/50 text-foreground rounded-xl border shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-primary)_35%,transparent),0_10px_28px_-14px_color-mix(in_oklab,var(--color-primary)_90%,transparent)]"
                            : "bg-surface-elevated text-surface-foreground hover:bg-surface-hover hover:text-foreground rounded-2xl hover:rounded-xl",
                        )}
                        style={
                          active && !server.icon_url
                            ? { backgroundImage: "var(--gradient-brand)" }
                            : undefined
                        }
                      >
                        {server.icon_url ? (
                          <img
                            src={server.icon_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          initials(server.name)
                        )}
                      </span>
                      <UnreadBadge
                        count={serverBadges[server.id] ?? 0}
                        title={`${serverBadges[server.id] ?? 0} mensagens não lidas; ${serverMentions[server.id] ?? 0} menções`}
                        className="absolute -right-0.5 -bottom-0.5"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{server.name}</TooltipContent>
                </Tooltip>
              </div>
            </ServerContextMenu>
          );
        })}
      </div>

      <span className="bg-border/80 mt-1 h-px w-8 rounded-full" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onAdd}
            aria-label="Criar ou entrar em servidor"
            className="border-border text-primary hover:border-primary/60 hover:bg-primary/10 flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed transition-all duration-200 hover:rounded-xl"
          >
            <Plus className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Criar ou entrar em servidor</TooltipContent>
      </Tooltip>

      <span className="bg-border/80 mt-1 h-px w-8 rounded-full" />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onSelectSocial}
            aria-label="Social"
            aria-current={socialActive ? "true" : undefined}
            className="group relative mt-1 mb-1 flex h-12 w-12 items-center justify-center"
          >
            <span
              aria-hidden
              className={cn(
                "absolute -left-3 w-1 rounded-r-full transition-all duration-200",
                socialActive
                  ? "bg-primary h-7 shadow-[0_0_12px_-1px_color-mix(in_oklab,var(--color-primary)_85%,transparent)]"
                  : "bg-foreground/45 h-0 group-hover:h-3.5",
              )}
            />
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center transition-all duration-200",
                socialActive
                  ? "border-primary/50 text-primary bg-primary/10 rounded-xl border shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-primary)_35%,transparent)]"
                  : "bg-surface-elevated text-surface-foreground hover:bg-surface-hover hover:text-foreground rounded-2xl hover:rounded-xl",
              )}
            >
              <Users className="h-5 w-5" />
            </span>
            <UnreadBadge
              count={socialBadge}
              title={`${socialBadge} mensagens ou solicitações pendentes`}
              className="absolute -right-0.5 -bottom-0.5"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Social</TooltipContent>
      </Tooltip>
    </nav>
  );
}
