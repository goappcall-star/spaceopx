import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import { StatusDot } from "@/components/app/StatusDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth";

export function UserBar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    try {
      await authService.signOut();
    } catch {
      toast.error("Não foi possível sair.");
      return;
    }
    await navigate({ to: "/login", replace: true });
  }

  return (
    <div className="border-border bg-rail flex items-center gap-2 border-t px-2.5 py-2.5">
      <Link
        to="/settings"
        className="hover:bg-surface-hover -mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 transition-colors"
        aria-label="Abrir configurações da conta"
      >
        <div className="relative shrink-0">
          <Avatar className="ring-border h-8 w-8 ring-1">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-surface-elevated text-xs">
              {profile?.display_name?.slice(0, 2).toUpperCase() ?? "??"}
            </AvatarFallback>
          </Avatar>
          <StatusDot
            status={profile?.status ?? "offline"}
            className="border-rail absolute -right-0.5 -bottom-0.5 border-2"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{profile?.display_name ?? "Carregando..."}</p>
          <p className="text-muted-foreground truncate font-mono text-[11px]">
            @{profile?.username ?? "..."}
          </p>
        </div>
      </Link>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label="Configurações"
          >
            <Link to="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Configurações</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-destructive hover:bg-destructive/15 h-8 w-8 shrink-0"
            aria-label="Sair"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Sair</TooltipContent>
      </Tooltip>
    </div>
  );
}
