import { Hash, Plus, UserPlus, Volume2 } from "lucide-react";

import { UserBar } from "@/components/app/UserBar";
import { VoiceBar } from "@/components/voice/VoiceBar";
import { Button } from "@/components/ui/button";
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

  const textChannels = channels.filter((c) => c.type !== "voice");
  const voiceChannels = channels.filter((c) => c.type === "voice");
  const activeVoiceChannel = channels.find((c) => c.id === voiceChannelId) ?? null;

  const memberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member?.nickname ?? member?.profile?.display_name ?? "Usuário";
  };

  return (
    <aside className="bg-surface border-border flex w-60 shrink-0 flex-col border-r">
      <div className="border-border border-b p-4">
        <h2 className="truncate text-sm font-semibold">{server.name}</h2>
        {server.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{server.description}</p>
        )}
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto p-2">
        <div className="flex items-center justify-between px-2 py-1.5">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
            Canais de texto
          </p>
          {canManage && (
            <button
              type="button"
              aria-label="Criar canal"
              className="text-muted-foreground hover:text-foreground"
              onClick={onCreateChannel}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <ul className="space-y-0.5">
          {textChannels.map((channel) => {
            const unread = unreadChannelIds.has(channel.id) && channel.id !== activeChannelId;
            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => onSelectChannel(channel.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    channel.id === activeChannelId
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    unread && "text-foreground font-semibold",
                  )}
                >
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                  {unread && <span className="bg-primary ml-auto h-2 w-2 rounded-full" />}
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-muted-foreground mt-4 px-2 py-1.5 text-[11px] font-semibold tracking-wider uppercase">
          Canais de voz
        </p>
        <ul className="space-y-0.5">
          {voiceChannels.length === 0 && (
            <li className="text-muted-foreground px-2 py-1 text-xs">Nenhum canal de voz.</li>
          )}
          {voiceChannels.map((channel) => {
            const participants = participantsByChannel[channel.id] ?? [];
            return (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectChannel(channel.id);
                    if (voiceChannelId !== channel.id) void join(channel.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    channel.id === activeChannelId
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Volume2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                  {participants.length > 0 && (
                    <span className="text-muted-foreground ml-auto text-[11px]">
                      {participants.length}
                    </span>
                  )}
                </button>
                {participants.length > 0 && (
                  <ul className="mt-0.5 mb-1 space-y-0.5 pl-8">
                    {participants.map((participant) => (
                      <li
                        key={participant.user_id}
                        className={cn(
                          "text-muted-foreground truncate text-xs",
                          participant.speaking && "text-success",
                        )}
                      >
                        {memberName(participant.user_id)}
                        {participant.muted && " 🔇"}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {canInvite && (
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={onInvite}>
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
