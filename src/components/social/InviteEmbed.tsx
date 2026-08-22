import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { inviteErrorMessage, invitesService } from "@/services/invites";

/** Extracts the first LobbyX invite code contained in a message. */
export function extractInviteCode(content: string): string | null {
  const match = content.match(/\/invite\/([A-Za-z0-9_-]{4,64})/);
  return match?.[1] ?? null;
}

/** Rich server-invite card rendered inline in direct messages. */
export function InviteEmbed({ code }: { code: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["invite-preview", code],
    queryFn: () => invitesService.preview(code),
    staleTime: 60_000,
  });

  const join = useMutation({
    mutationFn: () => invitesService.join(code),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["servers"] });
      toast.success("Você entrou no servidor.");
      await navigate({ to: "/app" });
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="border-border bg-surface-elevated/60 mt-2 h-28 w-full max-w-xs animate-pulse rounded-xl border" />
    );
  }

  if (!data) return null;

  return (
    <div className="border-border bg-surface-elevated/70 mt-2 w-full max-w-xs rounded-xl border p-3 backdrop-blur">
      <p className="text-muted-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
        Convite para servidor
      </p>
      <div className="flex items-center gap-3">
        <Avatar className="ring-border h-10 w-10 rounded-xl ring-1">
          <AvatarImage src={data.server_icon_url ?? undefined} alt="" />
          <AvatarFallback className="bg-surface rounded-xl text-xs">
            {(data.server_name ?? "??").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{data.server_name ?? "Servidor"}</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            {Number(data.member_count ?? 0)} membros
          </p>
        </div>
      </div>

      {!data.valid ? (
        <p className="text-muted-foreground mt-3 text-xs">Convite indisponível.</p>
      ) : data.already_member ? (
        <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => void navigate({ to: "/app" })}>
          Abrir servidor
        </Button>
      ) : (
        <Button
          size="sm"
          className="mt-3 w-full"
          disabled={join.isPending}
          onClick={() => join.mutate()}
        >
          {join.isPending ? "Entrando..." : "Entrar"}
        </Button>
      )}
    </div>
  );
}
