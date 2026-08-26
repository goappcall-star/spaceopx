import { ScrollText } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useServerAuditLogs } from "@/hooks/use-server-admin";
import { auditActionLabel } from "@/services/server-admin";
import type { Server } from "@/types";

export function SettingsAudit({ server }: { server: Server }) {
  const { data: logs, isLoading, error } = useServerAuditLogs(server.id);

  if (error) {
    return (
      <p className="text-muted-foreground text-sm">
        Você não tem permissão para ver o registro de auditoria.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Histórico somente leitura das ações administrativas, registrado automaticamente pelo
        backend.
      </p>
      <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
        {isLoading && (
          <li className="text-muted-foreground p-6 text-center text-sm">Carregando...</li>
        )}
        {(logs ?? []).map((log) => {
          const actor = log.actor_display_name ?? log.actor_username ?? "Sistema";
          return (
            <li key={log.id} className="flex items-start gap-3 p-3">
              <Avatar className="ring-border mt-0.5 h-8 w-8 ring-1">
                <AvatarImage src={log.actor_avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-surface-elevated text-[10px]">
                  {actor.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{actor}</span>{" "}
                  <span className="text-muted-foreground">{auditActionLabel(log.action)}</span>
                  {log.target_label && (
                    <span className="text-foreground/80"> · {log.target_label}</span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </li>
          );
        })}
        {!isLoading && (logs ?? []).length === 0 && (
          <li className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-sm">
            <ScrollText className="h-5 w-5" />
            Nenhuma ação registrada ainda.
          </li>
        )}
      </ul>
    </div>
  );
}
