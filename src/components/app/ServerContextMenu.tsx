import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
} from "@/components/ui/context-menu";
import { isServerMuted, type ServerPreferences } from "@/hooks/use-server-preferences";
import type { Server } from "@/types";

export type ServerMenuAction = "read" | "invite" | "privacy" | "profile" | "leave";
export function ServerContextMenu({
  children,
  server,
  preferences,
  onUpdate,
  onAction,
}: {
  children: ReactNode;
  server: Server;
  preferences: ServerPreferences;
  onUpdate: (patch: Partial<ServerPreferences>) => void;
  onAction: (action: ServerMenuAction, server: Server) => void;
}) {
  const labels = { all: "Todas as mensagens", mentions: "Apenas menções", none: "Nenhuma" };
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64 rounded-xl p-2" aria-label={`Opções de ${server.name}`}>
        <ContextMenuItem onSelect={() => onAction("read", server)}>
          Marcar como lida
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onAction("invite", server)}>
          Convidar para o servidor
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Silenciar servidor</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {isServerMuted(preferences) && (
              <ContextMenuItem onSelect={() => onUpdate({ mutedUntil: null })}>
                Reativar notificações
              </ContextMenuItem>
            )}
            {[15, 60, 180, 480, 1440].map((minutes) => (
              <ContextMenuItem
                key={minutes}
                onSelect={() => onUpdate({ mutedUntil: Date.now() + minutes * 60000 })}
              >
                {minutes < 60
                  ? `${minutes} minutos`
                  : minutes === 1440
                    ? "24 horas"
                    : `${minutes / 60} horas`}
              </ContextMenuItem>
            ))}
            <ContextMenuItem onSelect={() => onUpdate({ mutedUntil: -1 })}>
              Até eu reativar
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <span>
              Config. de notificação
              <span className="text-muted-foreground block text-xs">
                {labels[preferences.notifications]}
              </span>
            </span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup
              value={preferences.notifications}
              onValueChange={(value) =>
                onUpdate({ notifications: value as ServerPreferences["notifications"] })
              }
            >
              {Object.entries(labels).map(([value, label]) => (
                <ContextMenuRadioItem key={value} value={value}>
                  {label}
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuCheckboxItem
          checked={preferences.hideMutedChannels}
          onCheckedChange={(checked) => onUpdate({ hideMutedChannels: checked })}
        >
          Ocultar canais silenciados
        </ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onAction("privacy", server)}>
          Config. de privacidade
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onAction("profile", server)}>
          Editar perfil por servidor
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => onAction("leave", server)}
        >
          Sair do servidor
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
