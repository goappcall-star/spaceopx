import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from "@/components/ui/context-menu";
import type { Channel, ServerCategory } from "@/types";
import type { ServerPreferences } from "@/hooks/use-server-preferences";
import { isCategoryMuted } from "@/lib/channel-preferences";
function Notifications({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: "all" | "mentions" | "none" | "inherit") => void;
}) {
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>Config. de notificação</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as "all" | "mentions" | "none" | "inherit")}
        >
          <ContextMenuRadioItem value="inherit">Usar configuração padrão</ContextMenuRadioItem>
          <ContextMenuRadioItem value="all">Todas as mensagens</ContextMenuRadioItem>
          <ContextMenuRadioItem value="mentions">Somente menções</ContextMenuRadioItem>
          <ContextMenuRadioItem value="none">Nenhuma</ContextMenuRadioItem>
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
export function SidebarBlankMenu({
  children,
  preferences,
  update,
  canManage,
  canInvite,
  createChannel,
  createCategory,
  invite,
}: {
  children: ReactNode;
  preferences: ServerPreferences;
  update: (patch: Partial<ServerPreferences>) => void;
  canManage: boolean;
  canInvite: boolean;
  createChannel: () => void;
  createCategory: () => void;
  invite: () => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuCheckboxItem
          checked={preferences.hideMutedChannels}
          onCheckedChange={(value) => update({ hideMutedChannels: value })}
        >
          Ocultar canais silenciados
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        {canManage && (
          <>
            <ContextMenuItem onSelect={createChannel}>Criar canal</ContextMenuItem>
            <ContextMenuItem onSelect={createCategory}>Criar categoria</ContextMenuItem>
          </>
        )}
        {canInvite && <ContextMenuItem onSelect={invite}>Convidar para o servidor</ContextMenuItem>}
      </ContextMenuContent>
    </ContextMenu>
  );
}
export function SidebarCategoryMenu({
  children,
  category,
  preferences,
  update,
  collapsed,
  toggle,
  collapseAll,
  markRead,
  hasUnread,
  canManage,
  edit,
  remove,
  move,
  createChannel,
  copy,
}: {
  children: ReactNode;
  category: ServerCategory;
  preferences: ServerPreferences;
  update: (patch: Partial<ServerPreferences>) => void;
  collapsed: boolean;
  toggle: () => void;
  collapseAll: () => void;
  markRead: () => void;
  hasUnread: boolean;
  canManage: boolean;
  edit: () => void;
  remove: () => void;
  move: (where: "top" | "up" | "down" | "bottom") => void;
  createChannel: () => void;
  copy: () => void;
}) {
  const muted = isCategoryMuted(preferences, category.id);
  function notification(value: "all" | "mentions" | "none" | "inherit") {
    const next = { ...preferences.categoryNotifications };
    if (value === "inherit") delete next[category.id];
    else next[category.id] = value;
    update({ categoryNotifications: next });
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={(event) => event.stopPropagation()}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem disabled={!hasUnread} onSelect={markRead}>
          Marcar como lida
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem checked={collapsed} onCheckedChange={toggle}>
          Recolher categoria
        </ContextMenuCheckboxItem>
        <ContextMenuItem onSelect={collapseAll}>Recolher todas as categorias</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Silenciar categoria{muted ? " ✓" : ""}</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {[
              [15, "Por 15 minutos"],
              [60, "Por 1 hora"],
              [480, "Por 8 horas"],
              [-1, "Até eu reativar"],
            ].map(([minutes, label]) => (
              <ContextMenuItem
                key={minutes}
                onSelect={() =>
                  update({
                    mutedCategories: {
                      ...preferences.mutedCategories,
                      [category.id]: minutes === -1 ? -1 : Date.now() + Number(minutes) * 60000,
                    },
                  })
                }
              >
                {label}
              </ContextMenuItem>
            ))}
            {muted && (
              <ContextMenuItem
                onSelect={() => {
                  const next = { ...preferences.mutedCategories };
                  delete next[category.id];
                  update({ mutedCategories: next });
                }}
              >
                Reativar categoria
              </ContextMenuItem>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <Notifications
          value={preferences.categoryNotifications?.[category.id] ?? "inherit"}
          onChange={notification}
        />
        {canManage && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={createChannel}>Criar canal</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Mover para</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                {[
                  ["top", "Início"],
                  ["up", "Uma posição acima"],
                  ["down", "Uma posição abaixo"],
                  ["bottom", "Final"],
                ].map(([where, label]) => (
                  <ContextMenuItem
                    key={where}
                    onSelect={() => move(where as "top" | "up" | "down" | "bottom")}
                  >
                    {label}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem onSelect={edit}>Editar categoria</ContextMenuItem>
            <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={remove}>
              Excluir categoria
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={copy}>Copiar ID da categoria</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
export function SidebarChannelMenu({
  children,
  channel,
  categories,
  preferences,
  update,
  canManage,
  markRead,
  hasUnread,
  toggleMute,
  edit,
  remove,
  assign,
  invite,
  copy,
}: {
  children: ReactNode;
  channel: Channel;
  categories: ServerCategory[];
  preferences: ServerPreferences;
  update: (patch: Partial<ServerPreferences>) => void;
  canManage: boolean;
  markRead: () => void;
  hasUnread: boolean;
  toggleMute: () => void;
  edit: () => void;
  remove: () => void;
  assign: (id: string | null) => void;
  invite?: (() => void) | undefined;
  copy: () => void;
}) {
  function notification(value: "all" | "mentions" | "none" | "inherit") {
    const next = { ...preferences.channelNotifications };
    if (value === "inherit") delete next[channel.id];
    else next[channel.id] = value;
    update({ channelNotifications: next });
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={(event) => event.stopPropagation()}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        {channel.type !== "voice" && (
          <ContextMenuItem disabled={!hasUnread} onSelect={markRead}>
            Marcar como lido
          </ContextMenuItem>
        )}
        <ContextMenuCheckboxItem
          checked={preferences.mutedChannels.includes(channel.id)}
          onCheckedChange={toggleMute}
        >
          Silenciar canal
        </ContextMenuCheckboxItem>
        <Notifications
          value={preferences.channelNotifications?.[channel.id] ?? "inherit"}
          onChange={notification}
        />
        {invite && <ContextMenuItem onSelect={invite}>Convidar para o servidor</ContextMenuItem>}
        {canManage && (
          <>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Mover para</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuRadioGroup
                  value={channel.category_id ?? ""}
                  onValueChange={(value) => assign(value || null)}
                >
                  <ContextMenuRadioItem value="">Sem categoria</ContextMenuRadioItem>
                  {categories.map((category) => (
                    <ContextMenuRadioItem key={category.id} value={category.id}>
                      {category.name}
                    </ContextMenuRadioItem>
                  ))}
                </ContextMenuRadioGroup>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuItem onSelect={edit}>Editar canal</ContextMenuItem>
            <ContextMenuItem className="text-destructive focus:text-destructive" onSelect={remove}>
              Excluir canal
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={copy}>Copiar ID do canal</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
