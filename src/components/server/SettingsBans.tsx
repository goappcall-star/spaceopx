import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAdminMutation, useServerBans } from "@/hooks/use-server-admin";
import { serverAdminService } from "@/services/server-admin";
import type { Server } from "@/types";

export function SettingsBans({ server, canUnban }: { server: Server; canUnban: boolean }) {
  const { data: bans, isLoading } = useServerBans(server.id);
  const unban = useAdminMutation((banId: string) => serverAdminService.unbanUser(banId), {
    success: "Usuário desbanido.",
    invalidate: [["server-bans", server.id], ["audit-logs", server.id]],
  });

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Contas banidas não conseguem entrar novamente, mesmo com um link de convite válido — o
        bloqueio é aplicado no backend.
      </p>
      <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
        {isLoading && (
          <li className="text-muted-foreground p-6 text-center text-sm">Carregando...</li>
        )}
        {(bans ?? []).map((ban) => {
          const name = ban.display_name ?? ban.username ?? "Usuário";
          return (
            <li key={ban.id} className="flex items-center gap-3 p-3">
              <Avatar className="ring-border h-9 w-9 ring-1">
                <AvatarImage src={ban.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-surface-elevated text-xs">
                  {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {ban.reason ?? "Sem motivo informado"} ·{" "}
                  {new Date(ban.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {canUnban && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={unban.isPending}
                  onClick={() => unban.mutate(ban.id)}
                >
                  Desbanir
                </Button>
              )}
            </li>
          );
        })}
        {!isLoading && (bans ?? []).length === 0 && (
          <li className="text-muted-foreground p-6 text-center text-sm">Nenhum banimento ativo.</li>
        )}
      </ul>
    </div>
  );
}
