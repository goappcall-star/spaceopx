import { ChevronDown, Hash, Plus, Settings, UserPlus, Volume2 } from "lucide-react";
import { useState } from "react";

import { CategoryManager } from "@/components/app/CategoryManager";
import { useServerCategories } from "@/hooks/use-categories";
import { UserBar } from "@/components/app/UserBar";
import { VoiceParticipantActions } from "@/components/voice/VoiceParticipantActions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import type { Channel, MemberWithProfile, Server } from "@/types";
import type { ServerPreferences } from "@/hooks/use-server-preferences";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";

interface Props {
  server: Server;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onStartDirect?: ((id: string) => void) | undefined;
  members: MemberWithProfile[];
  unreadChannelIds: Set<string>;
  canInvite: boolean;
  canManage: boolean;
  canOpenSettings?: boolean;
  onOpenSettings?: () => void;
  onInvite: () => void;
  onCreateChannel: () => void;
  preferences: ServerPreferences;
  onToggleMuteChannel: (channelId: string) => void;
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
  onStartDirect,
  members,
  unreadChannelIds,
  canInvite,
  canManage,
  canOpenSettings = false,
  onOpenSettings,
  onInvite,
  onCreateChannel,
  preferences,
  onToggleMuteChannel,
}: Props) {
  const { participantsByChannel, activeChannelId: voiceChannelId, join } = useVoice();
  const [textOpen, setTextOpen] = useState(true);
  const [voiceOpen, setVoiceOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { data: categories = [], error: categoryError } = useServerCategories(server.id);

  const textChannels = channels.filter(
    (c) =>
      c.type !== "voice" &&
      (!preferences.hideMutedChannels ||
        !preferences.mutedChannels.includes(c.id) ||
        c.id === activeChannelId),
  );
  const voiceChannels = channels.filter((c) => c.type === "voice");

  const memberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member?.nickname ?? member?.profile?.display_name ?? "Usuário";
  };

  const renderText = (textChannels: Channel[]) => (
    <ul className="space-y-0.5">
      {textChannels.length === 0 && (
        <li className="text-muted-foreground px-2 py-1 text-xs">Nenhum canal de texto.</li>
      )}
      {textChannels.map((channel) => {
        const active = channel.id === activeChannelId;
        const unread =
          unreadChannelIds.has(channel.id) &&
          !active &&
          !preferences.mutedChannels.includes(channel.id);
        return (
          <li key={channel.id}>
            <ContextMenu>
              <ContextMenuTrigger asChild>
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
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuCheckboxItem
                  checked={preferences.mutedChannels.includes(channel.id)}
                  onCheckedChange={() => onToggleMuteChannel(channel.id)}
                >
                  Silenciar canal
                </ContextMenuCheckboxItem>
              </ContextMenuContent>
            </ContextMenu>
          </li>
        );
      })}
    </ul>
  );
  const renderVoice = (voiceChannels: Channel[]) => (
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
                  connectedHere
                    ? "text-success"
                    : active
                      ? "text-primary"
                      : "text-muted-foreground/70",
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
              <ul className="mt-1 mb-2 ml-6 space-y-1">
                {participants.map((participant) => (
                  <li
                    key={participant.user_id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors duration-150",
                      participant.speaking && !participant.muted
                        ? "bg-surface-active text-foreground font-medium"
                        : "text-muted-foreground",
                    )}
                  >
                    <VoiceParticipantActions
                      userId={participant.user_id}
                      member={members.find((member) => member.user_id === participant.user_id)}
                      onStartDirect={onStartDirect}
                      onInvite={canInvite ? onInvite : undefined}
                      onManageRoles={canManage ? onOpenSettings : undefined}
                    >
                      <div className="flex w-full items-center gap-2">
                        <Avatar
                          frame={
                            members.find((member) => member.user_id === participant.user_id)
                              ?.profile?.avatar_frame
                          }
                          className={cn(
                            "h-6 w-6 ring-2 ring-offset-2 ring-offset-surface transition-shadow duration-150",
                            participant.speaking && !participant.muted
                              ? "ring-green-500"
                              : "ring-transparent",
                          )}
                        >
                          <AvatarImage
                            src={
                              members.find((member) => member.user_id === participant.user_id)
                                ?.profile?.avatar_url ?? undefined
                            }
                            alt=""
                          />
                          <AvatarFallback className="text-[9px]">
                            {memberName(participant.user_id).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">
                          {memberName(participant.user_id)}
                        </span>
                        {participant.speaking && !participant.muted && (
                          <span className="sr-only">Falando</span>
                        )}
                        <span className="ml-auto flex shrink-0 items-center gap-1 text-[10px]">
                          {participant.screen && <span title="Compartilhando tela">🖥️</span>}
                          {participant.camera && <span title="Câmera ligada">🎥</span>}
                          {participant.muted && <span title="Mudo">🔇</span>}
                        </span>
                      </div>
                    </VoiceParticipantActions>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="bg-surface border-border relative z-20 flex w-64 shrink-0 flex-col border-r shadow-[6px_0_24px_-24px_rgba(0,0,0,0.9)]">
      {/* Server header */}
      <div
        className={cn(
          "border-border relative overflow-hidden border-b px-4 py-3.5",
          server.banner_url && "min-h-40 flex items-end",
        )}
      >
        {server.banner_url ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${server.banner_url})` }}
          />
        ) : null}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{ backgroundImage: "var(--gradient-ambient)" }}
        />
        <div
          className={cn(
            "relative flex w-full items-center gap-2",
            server.banner_url && "rounded-lg bg-surface/95 p-2",
          )}
        >
          <div className="min-w-0 flex-1">
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
          {canOpenSettings && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Configurações do servidor"
                  onClick={onOpenSettings}
                  className="text-muted-foreground hover:text-foreground hover:bg-surface-hover rounded-lg p-1.5 transition-colors"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Configurações do servidor</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="scrollbar-slim flex-1 overflow-y-auto px-2 py-2">
        {canManage && (
          <Button
            size="sm"
            variant="ghost"
            className="mb-2 w-full justify-start"
            onClick={() => setCategoriesOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Gerenciar categorias
          </Button>
        )}
        {categoryError && canManage && (
          <p className="text-muted-foreground mb-2 px-2 text-xs">
            Categorias indisponíveis. A atualização do banco precisa ser aplicada.
          </p>
        )}
        {categories.map((category) => (
          <div key={category.id} className="mb-3">
            <CategoryHeader
              label={category.name}
              count={channels.filter((c) => c.category_id === category.id).length}
              open={!collapsed.has(category.id)}
              onToggle={() =>
                setCollapsed((previous) => {
                  const next = new Set(previous);
                  if (next.has(category.id)) next.delete(category.id);
                  else next.add(category.id);
                  return next;
                })
              }
            />
            {!collapsed.has(category.id) && (
              <>
                {renderText(textChannels.filter((c) => c.category_id === category.id))}
                {renderVoice(voiceChannels.filter((c) => c.category_id === category.id))}
              </>
            )}
          </div>
        ))}

        <CategoryHeader
          label="Canais de texto"
          count={textChannels.length}
          open={textOpen}
          onToggle={() => setTextOpen((v) => !v)}
          {...(canManage ? { action: { label: "Criar canal", onClick: onCreateChannel } } : {})}
        />
        {textOpen &&
          renderText(
            textChannels.filter(
              (c) => !c.category_id || !categories.some((cat) => cat.id === c.category_id),
            ),
          )}

        <div className="mt-3">
          <CategoryHeader
            label="Canais de voz"
            count={voiceChannels.length}
            open={voiceOpen}
            onToggle={() => setVoiceOpen((v) => !v)}
            {...(canManage ? { action: { label: "Criar canal", onClick: onCreateChannel } } : {})}
          />
        </div>
        {voiceOpen &&
          renderVoice(
            voiceChannels.filter(
              (c) => !c.category_id || !categories.some((cat) => cat.id === c.category_id),
            ),
          )}

        {canInvite && (
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar pessoas
          </Button>
        )}
      </div>

      {canManage && (
        <CategoryManager
          key={server.id}
          serverId={server.id}
          categories={categories}
          channels={channels}
          open={categoriesOpen}
          onOpenChange={setCategoriesOpen}
        />
      )}
      <UserBar />
    </aside>
  );
}
