import { UnreadBadge } from "./UnreadBadge";
import { ChevronDown, Hash, Plus, Settings, UserPlus, Volume2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { memberHasPermission } from "@/services/permissions";
import { useVoiceMemberDrag } from "@/hooks/use-voice-member-drag";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoriesService } from "@/services/categories";
import { channelsService } from "@/services/channels";
import { isChannelMuted } from "@/lib/channel-preferences";
import {
  SidebarBlankMenu,
  SidebarCategoryMenu,
  SidebarChannelMenu,
} from "@/components/app/SidebarContextMenus";
import { EditChannelDialog } from "@/components/app/EditChannelDialog";
import { ConfirmActionDialog } from "@/components/app/ConfirmActionDialog";
import { CreateChannelDialog } from "@/components/app/CreateChannelDialog";

import { CategoryManager } from "@/components/app/CategoryManager";
import { useServerCategories } from "@/hooks/use-categories";
import { useSidebarDrag } from "@/hooks/use-sidebar-drag";
import { UserBar } from "@/components/app/UserBar";
import { VoiceParticipantActions } from "@/components/voice/VoiceParticipantActions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import type { Channel, MemberWithProfile, Server, ServerCategory } from "@/types";
import type { ServerPreferences } from "@/hooks/use-server-preferences";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuCheckboxItem,
  ContextMenuItem,
} from "@/components/ui/context-menu";

interface Props {
  server: Server;
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channelId: string) => void;
  onStartDirect?: ((id: string) => void) | undefined;
  members: MemberWithProfile[];
  unreadChannelIds: Set<string>;
  unreadCounts?: Record<string, number>;
  mentionCounts?: Record<string, number>;
  canInvite: boolean;
  canManage: boolean;
  canOpenSettings?: boolean;
  onOpenSettings?: () => void;
  onInvite: () => void;
  onCreateChannel: () => void;
  preferences: ServerPreferences;
  onToggleMuteChannel: (channelId: string) => void;
  onUpdatePreferences: (patch: Partial<ServerPreferences>) => void;
  onMarkRead: (channelIds: string[]) => void;
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
  unreadCounts = {},
  mentionCounts = {},
  canInvite,
  canManage,
  canOpenSettings = false,
  onOpenSettings,
  onInvite,
  onCreateChannel,
  preferences,
  onToggleMuteChannel,
  onUpdatePreferences,
  onMarkRead,
}: Props) {
  const { participantsByChannel, activeChannelId: voiceChannelId, join } = useVoice();
  const { user } = useAuth();
  const memberDrag = useVoiceMemberDrag(
    server.id,
    memberHasPermission(
      members.find((m) => m.user_id === user?.id),
      server.owner_id,
      "administrator",
    ),
    participantsByChannel,
  );
  const [unassignedOpen, setUnassignedOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServerCategory | undefined>();
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [creatingChannelIn, setCreatingChannelIn] = useState<string | null>(null);
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => Promise<unknown>;
  } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const { data: categories = [], error: categoryError } = useServerCategories(server.id);
  const drag = useSidebarDrag(server.id, canManage, channels, categories, (id) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      next.delete(id);
      return next;
    });
    if (id === "") setUnassignedOpen(true);
  });

  const textChannels = channels.filter(
    (c) =>
      c.type !== "voice" &&
      (!preferences.hideMutedChannels ||
        !isChannelMuted(preferences, c) ||
        c.id === activeChannelId),
  );
  const voiceChannels = channels.filter(
    (c) =>
      c.type === "voice" &&
      (!preferences.hideMutedChannels ||
        !isChannelMuted(preferences, c) ||
        c.id === activeChannelId ||
        c.id === voiceChannelId),
  );
  const collapseAll = () => {
    setCollapsed(new Set(categories.map((category) => category.id)));
    setUnassignedOpen(false);
  };
  const toggleCategory = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  async function run(operation: () => Promise<unknown>) {
    try {
      await operation();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["categories", server.id] }),
        client.invalidateQueries({ queryKey: ["channels", server.id] }),
      ]);
      return true;
    } catch {
      toast.error("Não foi possível atualizar. Confira sua permissão de gerenciar canais.");
      return false;
    }
  }
  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("ID copiado.");
    } catch {
      toast.error("Não foi possível copiar o ID.");
    }
  }
  function moveCategory(category: ServerCategory, where: "top" | "up" | "down" | "bottom") {
    const next = [...categories],
      index = next.findIndex((item) => item.id === category.id);
    if (index < 0) return;
    const target =
      where === "top"
        ? 0
        : where === "bottom"
          ? next.length - 1
          : Math.max(0, Math.min(next.length - 1, index + (where === "up" ? -1 : 1)));
    next.splice(index, 1);
    next.splice(target, 0, category);
    void run(() => categoriesService.reorder(server.id, next));
  }
  const channelMenu = (channel: Channel, children: React.ReactNode) => (
    <SidebarChannelMenu
      channel={channel}
      categories={categories}
      preferences={preferences}
      update={onUpdatePreferences}
      canManage={canManage}
      markRead={() => onMarkRead([channel.id])}
      hasUnread={unreadChannelIds.has(channel.id)}
      toggleMute={() => onToggleMuteChannel(channel.id)}
      edit={() => setEditingChannel(channel)}
      remove={() => {
        setConfirmation({
          title: `Excluir canal ${channel.name}?`,
          description: "As mensagens deste canal serão excluídas. Esta ação não pode ser desfeita.",
          action: () => channelsService.remove(server.id, channel.id),
        });
      }}
      assign={(id) => void run(() => categoriesService.assignChannel(server.id, channel.id, id))}
      invite={canInvite ? onInvite : undefined}
      copy={() => void copy(channel.id)}
    >
      {children}
    </SidebarChannelMenu>
  );

  const memberName = (userId: string) => {
    const member = members.find((m) => m.user_id === userId);
    return member?.nickname ?? member?.profile?.display_name ?? "Usuário";
  };
  const defaultHeader = (label: string, items: Channel[], open: boolean, toggle: () => void) => (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={(event) => event.stopPropagation()}>
        <div
          {...drag.zone(null)}
          className={cn(
            drag.source?.kind === "channel" && "rounded-lg border border-dashed border-primary/40",
            drag.target?.id === null && "bg-primary/15 ring-2 ring-primary",
          )}
        >
          <CategoryHeader
            label={label}
            count={items.length}
            open={open}
            onToggle={toggle}
            {...(canManage ? { action: { label: "Criar canal", onClick: onCreateChannel } } : {})}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem
          disabled={!items.some((channel) => unreadChannelIds.has(channel.id))}
          onSelect={() =>
            onMarkRead(
              items.filter((channel) => channel.type !== "voice").map((channel) => channel.id),
            )
          }
        >
          Marcar como lida
        </ContextMenuItem>
        <ContextMenuCheckboxItem checked={!open} onCheckedChange={toggle}>
          Recolher categoria
        </ContextMenuCheckboxItem>
        <ContextMenuItem onSelect={collapseAll}>Recolher todas as categorias</ContextMenuItem>
        <ContextMenuCheckboxItem
          checked={
            items.length > 0 &&
            items.every((channel) => preferences.mutedChannels.includes(channel.id))
          }
          onCheckedChange={(value) =>
            onUpdatePreferences({
              mutedChannels: value
                ? [
                    ...new Set([
                      ...preferences.mutedChannels,
                      ...items.map((channel) => channel.id),
                    ]),
                  ]
                : preferences.mutedChannels.filter(
                    (id) => !items.some((channel) => channel.id === id),
                  ),
            })
          }
        >
          Silenciar categoria
        </ContextMenuCheckboxItem>
        {canManage && <ContextMenuItem onSelect={onCreateChannel}>Criar canal</ContextMenuItem>}
      </ContextMenuContent>
    </ContextMenu>
  );

  const renderText = (textChannels: Channel[]) => (
    <ul className="space-y-0.5">
      {textChannels.length === 0 && (
        <li className="text-muted-foreground px-2 py-1 text-xs">Nenhum canal de texto.</li>
      )}
      {textChannels.map((channel) => {
        const active = channel.id === activeChannelId;
        const unread =
          unreadChannelIds.has(channel.id) && !active && !isChannelMuted(preferences, channel);
        return (
          <li
            key={channel.id}
            {...memberDrag.zone(channel.id)}
            className={cn(
              memberDrag.target === channel.id && "rounded-lg ring-2 ring-primary bg-primary/10",
            )}
          >
            {channelMenu(
              channel,
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
                {(unreadCounts[channel.id] ?? 0) > 0 ? (
                  <UnreadBadge
                    count={unreadCounts[channel.id] ?? 0}
                    className="ml-auto"
                    title={`${unreadCounts[channel.id]} mensagens não lidas; ${mentionCounts[channel.id] ?? 0} menções`}
                  />
                ) : (
                  unread && (
                    <span className="bg-primary ml-auto h-2 w-2 shrink-0 rounded-full shadow-[0_0_8px_0_color-mix(in_oklab,var(--color-primary)_80%,transparent)]" />
                  )
                )}
              </button>,
            )}
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
          <li
            key={channel.id}
            {...memberDrag.zone(channel.id)}
            className={cn(
              memberDrag.target === channel.id && "rounded-lg ring-2 ring-primary bg-primary/10",
            )}
          >
            {channelMenu(
              channel,
              <button
                type="button"
                {...drag.draggable("channel", channel.id)}
                title={
                  canManage ? "Clique e arraste para mover o canal para outra categoria" : undefined
                }
                onClick={() => {
                  if (drag.suppressClick()) return;
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
                {channel.is_afk && (
                  <span className="text-muted-foreground text-[10px] font-semibold">AFK</span>
                )}
                {participants.length > 0 && (
                  <span className="bg-surface-elevated text-muted-foreground ml-auto rounded-full px-1.5 py-px text-[10px] font-semibold">
                    {participants.length}
                  </span>
                )}
              </button>,
            )}
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
          server.banner_url && "min-h-32 flex items-end",
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

      <SidebarBlankMenu
        preferences={preferences}
        update={onUpdatePreferences}
        canManage={canManage}
        canInvite={canInvite}
        createChannel={onCreateChannel}
        createCategory={() => {
          setEditingCategory(undefined);
          setCategoriesOpen(true);
        }}
        invite={onInvite}
      >
        <div
          className="scrollbar-slim flex-1 overflow-y-auto px-2 py-2"
          data-testid="channel-sidebar-space"
        >
          {categoryError && canManage && (
            <p className="text-muted-foreground mb-2 px-2 text-xs">
              Categorias indisponíveis. A atualização do banco precisa ser aplicada.
            </p>
          )}
          {categories.map((category) => (
            <div
              key={category.id}
              {...drag.zone(category.id)}
              data-testid={`category-drop-${category.id}`}
              className={cn(
                "relative mb-3 rounded-lg",
                drag.source?.kind === "channel" && "border border-dashed border-primary/30",
                drag.source?.kind === "channel" &&
                  drag.target?.id === category.id &&
                  "bg-primary/15 ring-2 ring-primary",
                drag.source?.kind === "category" &&
                  drag.target?.id === category.id &&
                  (drag.target.after
                    ? "after:absolute after:bottom-0 after:inset-x-0 after:h-0.5 after:bg-primary"
                    : "before:absolute before:top-0 before:inset-x-0 before:h-0.5 before:bg-primary"),
              )}
            >
              <SidebarCategoryMenu
                category={category}
                preferences={preferences}
                update={onUpdatePreferences}
                collapsed={collapsed.has(category.id)}
                toggle={() => toggleCategory(category.id)}
                collapseAll={collapseAll}
                markRead={() =>
                  onMarkRead(
                    channels
                      .filter(
                        (channel) =>
                          channel.category_id === category.id && channel.type !== "voice",
                      )
                      .map((channel) => channel.id),
                  )
                }
                hasUnread={channels.some(
                  (channel) =>
                    channel.category_id === category.id && unreadChannelIds.has(channel.id),
                )}
                canManage={canManage}
                edit={() => {
                  setEditingCategory(category);
                  setCategoriesOpen(true);
                }}
                remove={() => {
                  setConfirmation({
                    title: `Excluir categoria ${category.name}?`,
                    description: "Seus canais serão mantidos e aparecerão em “Sem categoria”.",
                    action: () => categoriesService.remove(server.id, category.id),
                  });
                }}
                move={(where) => moveCategory(category, where)}
                createChannel={() => setCreatingChannelIn(category.id)}
                copy={() => void copy(category.id)}
              >
                <div
                  data-category-header
                  {...drag.draggable("category", category.id)}
                  onClickCapture={(event) => {
                    if (drag.suppressClick()) {
                      event.preventDefault();
                      event.stopPropagation();
                    }
                  }}
                  className={cn(
                    canManage && "cursor-grab active:cursor-grabbing",
                    drag.source?.kind === "category" &&
                      drag.source.id === category.id &&
                      "opacity-50",
                  )}
                  title={
                    canManage ? "Clique e arraste para mudar a posição da categoria" : undefined
                  }
                >
                  <CategoryHeader
                    label={category.name}
                    count={channels.filter((c) => c.category_id === category.id).length}
                    open={!collapsed.has(category.id)}
                    onToggle={() => toggleCategory(category.id)}
                  />
                </div>
              </SidebarCategoryMenu>
              {!collapsed.has(category.id) && (
                <>
                  {textChannels.some((c) => c.category_id === category.id) &&
                    renderText(textChannels.filter((c) => c.category_id === category.id))}
                  {voiceChannels.some((c) => c.category_id === category.id) &&
                    renderVoice(voiceChannels.filter((c) => c.category_id === category.id))}
                </>
              )}
            </div>
          ))}

          {(channels.some(
            (c) => !c.category_id || !categories.some((cat) => cat.id === c.category_id),
          ) ||
            drag.source?.kind === "channel") && (
            <div className="mt-3">
              {defaultHeader(
                "Sem categoria",
                channels.filter(
                  (c) => !c.category_id || !categories.some((cat) => cat.id === c.category_id),
                ),
                unassignedOpen,
                () => setUnassignedOpen((v) => !v),
              )}
              {unassignedOpen && (
                <>
                  {renderText(
                    textChannels.filter(
                      (c) => !c.category_id || !categories.some((cat) => cat.id === c.category_id),
                    ),
                  )}
                  {renderVoice(
                    voiceChannels.filter(
                      (c) => !c.category_id || !categories.some((cat) => cat.id === c.category_id),
                    ),
                  )}
                </>
              )}
            </div>
          )}

          {canInvite && (
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onInvite}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar pessoas
            </Button>
          )}
          {drag.saving && (
            <p className="px-2 py-2 text-xs text-muted-foreground" role="status">
              Salvando posição…
            </p>
          )}
          <p className="sr-only" aria-live="polite">
            {drag.announcement}
          </p>
        </div>
      </SidebarBlankMenu>

      {canManage && categoriesOpen && (
        <CategoryManager
          key={server.id + (editingCategory?.id ?? "new")}
          serverId={server.id}
          categories={categories}
          category={editingCategory}
          onOpenChange={setCategoriesOpen}
        />
      )}
      {canManage && editingChannel && (
        <EditChannelDialog
          key={editingChannel.id}
          channel={editingChannel}
          onClose={() => setEditingChannel(null)}
        />
      )}
      {canManage && creatingChannelIn && (
        <CreateChannelDialog
          key={creatingChannelIn}
          serverId={server.id}
          open
          defaultCategoryId={creatingChannelIn}
          onOpenChange={(open) => {
            if (!open) setCreatingChannelIn(null);
          }}
          onCreated={onSelectChannel}
        />
      )}
      {confirmation && (
        <ConfirmActionDialog
          title={confirmation.title}
          description={confirmation.description}
          onConfirm={() => run(confirmation.action)}
          onClose={() => setConfirmation(null)}
        />
      )}
      <UserBar />
    </aside>
  );
}
