import { Hash, UserPlus } from "lucide-react";

import { UserBar } from "@/components/app/UserBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Channel, Server } from "@/types";

interface Props {
  server: Server;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  canInvite: boolean;
  onInvite: () => void;
}

export function ChannelSidebar({
  server,
  channels,
  activeChannelId,
  onSelectChannel,
  canInvite,
  onInvite,
}: Props) {
  return (
    <aside className="bg-surface border-border flex w-60 shrink-0 flex-col border-r">
      <div className="border-border border-b p-4">
        <h2 className="truncate text-sm font-semibold">{server.name}</h2>
        {server.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{server.description}</p>
        )}
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto p-2">
        <p className="text-muted-foreground px-2 py-1.5 text-[11px] font-semibold tracking-wider uppercase">
          Canais de texto
        </p>
        <ul className="space-y-0.5">
          {channels.map((channel) => (
            <li key={channel.id}>
              <button
                type="button"
                onClick={() => onSelectChannel(channel.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  channel.id === activeChannelId
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Hash className="h-4 w-4 shrink-0" />
                <span className="truncate">{channel.name}</span>
              </button>
            </li>
          ))}
        </ul>

        {canInvite && (
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar pessoas
          </Button>
        )}
      </div>

      <UserBar />
    </aside>
  );
}
