import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import { StatusDot } from "@/components/app/StatusDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
    <div className="border-border bg-rail flex items-center gap-2 border-t p-2.5">
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-secondary text-xs">
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
        <p className="text-muted-foreground truncate font-mono text-xs">
          @{profile?.username ?? "..."}
        </p>
      </div>
      <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label="Configurações">
        <Link to="/settings">
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        aria-label="Sair"
        onClick={handleSignOut}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
