import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Server } from "@/types";

interface Props {
  servers: Server[];
  activeServerId: string | null;
  onSelect: (serverId: string) => void;
  onAdd: () => void;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function ServerRail({ servers, activeServerId, onSelect, onAdd }: Props) {
  return (
    <nav
      aria-label="Servidores"
      className="bg-rail border-border flex w-[72px] shrink-0 flex-col items-center gap-2 border-r py-3"
    >
      <Link to="/app" className="mb-1" aria-label="SecureChat">
        <Logo compact />
      </Link>
      <span className="bg-border h-px w-8" />

      <div className="scrollbar-slim flex flex-1 flex-col items-center gap-2 overflow-y-auto">
        {servers.map((server) => {
          const active = server.id === activeServerId;
          return (
            <Tooltip key={server.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(server.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl text-sm font-semibold transition-all",
                    active
                      ? "bg-primary text-primary-foreground rounded-xl"
                      : "bg-surface text-surface-foreground hover:bg-accent hover:rounded-xl",
                  )}
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
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{server.name}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onAdd}
            aria-label="Criar ou entrar em servidor"
            className="border-border text-primary hover:bg-primary hover:text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed transition-all hover:rounded-xl"
          >
            <Plus className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Criar ou entrar em servidor</TooltipContent>
      </Tooltip>
    </nav>
  );
}
