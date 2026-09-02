import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, LogOut, Repeat, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { STATUS_LABEL, StatusDot } from "@/components/app/StatusDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalPresence, type SelectableStatus } from "@/hooks/use-global-presence";
import { authService } from "@/services/auth";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: SelectableStatus; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "idle", label: "Ausente" },
  { value: "dnd", label: "Não perturbar" },
];

export function UserBar() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { myStatus, setStatus, connection } = useGlobalPresence();
  const [open, setOpen] = useState(false);

  /** Full teardown so nothing leaks between accounts. */
  async function resetSession() {
    await queryClient.cancelQueries();
    try {
      await authService.signOut();
    } catch {
      toast.error("Não foi possível sair.");
      return false;
    }
    queryClient.clear();
    queryClient.removeQueries();
    try {
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    return true;
  }

  async function handleSignOut() {
    if (await resetSession()) await navigate({ to: "/login", replace: true });
  }

  async function handleSwitchAccount() {
    if (await resetSession()) {
      toast.success("Entre com outra conta.");
      await navigate({ to: "/login", replace: true });
    }
  }

  async function copyUsername() {
    if (!profile?.username) return;
    try {
      await navigator.clipboard.writeText(`@${profile.username}`);
      toast.success("Username copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="border-border bg-rail flex items-center gap-2 border-t px-2.5 py-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hover:bg-surface-hover -mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors"
            aria-label="Abrir menu da conta"
          >
            <div className="relative shrink-0">
              <Avatar className="ring-border h-8 w-8 ring-1">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-surface-elevated text-xs">
                  {profile?.display_name?.slice(0, 2).toUpperCase() ?? "??"}
                </AvatarFallback>
              </Avatar>
              <StatusDot
                status={myStatus}
                className="border-rail absolute -right-0.5 -bottom-0.5 border-2"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {profile?.display_name ?? "Carregando..."}
              </p>
              <p className="text-muted-foreground truncate font-mono text-[11px]">
                @{profile?.username ?? "..."}
              </p>
            </div>
          </button>
        </PopoverTrigger>

        <PopoverContent side="top" align="start" className="glass-panel w-64 p-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="ring-border h-10 w-10 ring-1">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-surface-elevated text-xs">
                {profile?.display_name?.slice(0, 2).toUpperCase() ?? "??"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{profile?.display_name ?? "—"}</p>
              <p className="text-muted-foreground truncate font-mono text-[11px]">
                @{profile?.username ?? "..."}
              </p>
            </div>
          </div>

          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[11px]">
            <StatusDot status={myStatus} className="h-2.5 w-2.5" />
            {STATUS_LABEL[myStatus]}
            {connection === "reconnecting" && (
              <span className="text-warning">· reconectando...</span>
            )}
          </p>

          <div className="border-border/70 my-3 border-t" />

          <p className="text-caption mb-1.5">Status</p>
          <div className="space-y-0.5">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => void setStatus(option.value)}
                className={cn(
                  "hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  myStatus === option.value && "bg-surface-hover",
                )}
              >
                <StatusDot status={option.value} className="h-2.5 w-2.5" />
                {option.label}
              </button>
            ))}
          </div>

          <div className="border-border/70 my-3 border-t" />

          <div className="space-y-0.5">
            <Link
              to="/settings/profile"
              onClick={() => setOpen(false)}
              className="hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors"
            >
              <Settings className="h-4 w-4" />
              Editar perfil
            </Link>
            <button
              type="button"
              onClick={() => void copyUsername()}
              className="hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
            >
              <Copy className="h-4 w-4" />
              Copiar username
            </button>
            <button
              type="button"
              onClick={() => void handleSwitchAccount()}
              className="hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
            >
              <Repeat className="h-4 w-4" />
              Mudar de conta
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="text-destructive hover:bg-destructive/15 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </PopoverContent>
      </Popover>

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
    </div>
  );
}
