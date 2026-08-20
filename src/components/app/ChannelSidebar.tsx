import { ChevronDown, Hash, Plus, UserPlus, Volume2 } from "lucide-react";
import { useState } from "react";

import { UserBar } from "@/components/app/UserBar";
import { VoiceBar } from "@/components/voice/VoiceBar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import type { Channel, MemberWithProfile, Server } from "@/types";

interface Props {
  server: Server;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  members: MemberWithProfile[];
  unreadChannelIds: Set<string>;
  canInvite: boolean;
  canManage: boolean;
  onInvite: () => void;
  onCreateChannel: () => void;
}

function CategoryHeader({
  label,
  count,
  open,
  onToggle,
  action,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="group/cat flex items-center gap-1 px-1.5 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="text-muted-foreground hover:text-foreground flex flex-1 items-center gap-1 transition-colors"
      >
        <ChevronDown
          className={cn("h-3 w-3 transition-transform duration-200", !open && "-rotate-90")}
        />
        <span className="text-caption">{label}</span>
        <span className="text-muted-foreground/60 ml-1 text-[10px] font-semibold">{count}</span>
      </button>
      {action && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={action.label}
              onClick={action.onClick}
              className="text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded p-0.5 opacity-0 transition-all group-hover/cat:opacity-100 focus-visible:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{action.label}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function ChannelSidebar({
  server,
  channels,
  activeChannelId,
  onSelectChannel,
  members,
  unreadChannelIds,
  canInvite,
  canManage,
  onInvite,
  onCreateChannel,
}: Props) {
  const { participantsByChannel, activeChannelId: voiceChannelId, join } = useVoice();
  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);

  const textChannels = channels.filter((c) => c.type !== "voice");
  const voiceChannels = channels.filter((c) => c.type === "voice");
  const activeVoiceChannel = channels.find((c) => c.id === voiceChannelId) ?? null;

  const memberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member?.nickname ?? member?.profile?.display_name ?? "Usuário";
  };

  return (
    <aside className="bg-surface border-border relative z-20 flex w-64 shrink-0 flex-col border-r shadow-[6px_0_24px_-24px_rgba(0,0,0,0.9)]">
      {/* Server header */}
      <div className="border-border relative overflow-hidden border-b px-4 py-3.5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundImage: "var(--gradient-ambient)" }}
        />
        <div className="relative">
          <h2 className="truncate text-sm font-semibold tracking-tight">{server.name}</h2>
          {server.description ? (
            <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
              {server.description}
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {members.length} {members.length === 1 ? "membro" : "membros"}
            </p>
          )}
        </div>
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto px-2 py-2">
        <CategoryHeader
          label="Canais de texto"
          count={textChannels.length}
          open={textOpen}
          onToggle={() => setTextOpen((v) => !v)}
          {...(canManage
            ? { action: { label: "Criar canal", onClick: onCreateChannel } }
            : {})}
        />
        {textOpen && (
          <ul className="space-y-0.5">
            {textChannels.length === 0 && (
              <li className="text-muted-foreground px-2 py-1 text-xs">Nenhum canal de texto.</li>
            )}
            {textChannels.map((channel) => {
              const active = channel.id === activeChannelId;
              const unread = unreadChannelIds.has(channel.id) && !active;
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => onSelectChannel(channel.id)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150",
                      active
                        ? "accent-marker bg-surface-active text-foreground font-medium"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                      unread && "text-foreground font-semibold",
                    )}
                  >
                    <Hash
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground/70",
                      )}
                    />
                    <span className="truncate">{channel.name}</span>
                    {unread && (
                      <span className="bg-primary ml-auto h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_0_color-mix(in_oklab,var(--color-primary)_80%,transparent)]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3">
          <CategoryHeader
            label="Canais de voz"
            count={voiceChannels.length}
            open={voiceOpen}
            onToggle={() => setVoiceOpen((v) => !v)}
            {...(canManage
              ? { action: { label: "Criar canal", onClick: onCreateChannel } }
              : {})}
          />
        </div>
        {voiceOpen && (
          <ul className="space-y-0.5">
            {voiceChannels.length === 0 && (
              <li className="text-muted-foreground px-2 py-1 text-xs">Nenhum canal de voz.</li>
            )}
            {voiceChannels.map((channel) => {
              const participants = participantsByChannel[channel.id] ?? [];
              const active = channel.id === activeChannelId;
              const connectedHere = voiceChannelId === channel.id;
              return (
                <li key={channel.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectChannel(channel.id);
                      if (voiceChannelId !== channel.id) void join(channel.id);
                    }}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150",
                      active
                        ? "accent-marker bg-surface-active text-foreground font-medium"
                        : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <Volume2
                      className={cn(
                        "h-4 w-4 shrink-0",
                        connectedHere ? "text-success" : active ? "text-primary" : "text-muted-foreground/70",
                      )}
                    />
                    <span className="truncate">{channel.name}</span>
                    {participants.length > 0 && (
                      <span className="bg-surface-elevated text-muted-foreground ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold">
                        {participants.length}
                      </span>
                    )}
                  </button>
                  {participants.length > 0 && (
                    <ul className="border-border/60 mt-0.5 mb-1 ml-4 space-y-0.5 border-l pl-3">
                      {participants.map((participant) => (
                        <li
                          key={participant.user_id}
                          className={cn(
                            "flex items-center gap-1.5 truncate py-0.5 text-xs transition-colors",
                            participant.speaking ? "text-success font-medium" : "text-muted-foreground",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              participant.speaking ? "bg-success animate-pulse" : "bg-muted-foreground/50",
                            )}
                          />
                          <span className="truncate">{memberName(participant.user_id)}</span>
                          <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px]">
                            {participant.screen && <span title="Compartilhando tela">🖥️</span>}
                            {participant.camera && <span title="Câmera ligada">🎥</span>}
                            {participant.muted && <span title="Mudo">🔇</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canInvite && (
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar pessoas
          </Button>
        )}
      </div>

      {activeVoiceChannel && <VoiceBar channelName={activeVoiceChannel.name} />}
      <UserBar />
    </aside>
  );
}
