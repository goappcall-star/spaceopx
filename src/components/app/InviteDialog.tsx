import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { inviteUrl, invitesService, inviteErrorMessage } from "@/services/invites";

interface Props {
  serverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({ serverId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const { data: invites } = useQuery({
    queryKey: ["invites", serverId],
    queryFn: () => invitesService.listByServer(serverId),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => invitesService.create(serverId, null, 168),
    onSuccess: async (code) => {
      await queryClient.invalidateQueries({ queryKey: ["invites", serverId] });
      await copy(inviteUrl(code));
      toast.success("Convite criado e copiado.");
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => invitesService.revoke(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invites", serverId] });
      toast.success("Convite revogado.");
    },
    onError: () => toast.error("Não foi possível revogar o convite."),
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar pessoas</DialogTitle>
          <DialogDescription>
            Convites válidos por 7 dias. Apenas proprietário e administradores podem criá-los.
          </DialogDescription>
        </DialogHeader>

        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Gerando..." : "Gerar novo convite"}
        </Button>

        <ul className="scrollbar-slim max-h-64 space-y-2 overflow-y-auto">
          {(invites ?? []).map((invite) => (
            <li
              key={invite.id}
              className="border-border bg-surface flex items-center gap-2 rounded-lg border p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{invite.code}</p>
                <p className="text-muted-foreground text-xs">
                  {invite.uses} uso(s)
                  {invite.max_uses ? ` de ${invite.max_uses}` : ""} ·{" "}
                  {invite.expires_at
                    ? `expira em ${new Date(invite.expires_at).toLocaleDateString("pt-BR")}`
                    : "sem expiração"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Copiar link"
                onClick={() => {
                  void copy(inviteUrl(invite.code));
                  toast.success("Link copiado.");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Revogar convite"
                onClick={() => revokeMutation.mutate(invite.id)}
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            </li>
          ))}
          {invites?.length === 0 && (
            <li className="text-muted-foreground py-4 text-center text-sm">
              Nenhum convite ativo ainda.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
