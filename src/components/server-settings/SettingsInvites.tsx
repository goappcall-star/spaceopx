import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Share2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteErrorMessage, inviteUrl, invitesService } from "@/services/invites";
import type { Server } from "@/types";

const EXPIRY_OPTIONS = [
  { value: "1", label: "1 hora" },
  { value: "24", label: "1 dia" },
  { value: "168", label: "7 dias" },
  { value: "720", label: "30 dias" },
  { value: "0", label: "Nunca" },
];

const USE_OPTIONS = [
  { value: "0", label: "Ilimitado" },
  { value: "1", label: "1 uso" },
  { value: "5", label: "5 usos" },
  { value: "10", label: "10 usos" },
  { value: "25", label: "25 usos" },
];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard unavailable */
  }
}

export function SettingsInvites({ server, canCreate }: { server: Server; canCreate: boolean }) {
  const queryClient = useQueryClient();
  const [expiry, setExpiry] = useState("168");
  const [maxUses, setMaxUses] = useState("0");

  const { data: invites } = useQuery({
    queryKey: ["invites", server.id],
    queryFn: () => invitesService.listByServer(server.id),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      invitesService.create(
        server.id,
        Number(maxUses) > 0 ? Number(maxUses) : null,
        Number(expiry) > 0 ? Number(expiry) : null,
      ),
    onSuccess: async (code) => {
      await queryClient.invalidateQueries({ queryKey: ["invites", server.id] });
      void queryClient.invalidateQueries({ queryKey: ["audit-logs", server.id] });
      await copy(inviteUrl(code));
      toast.success("Convite criado e copiado.");
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => invitesService.revoke(inviteId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invites", server.id] });
      void queryClient.invalidateQueries({ queryKey: ["audit-logs", server.id] });
      toast.success("Convite revogado.");
    },
    onError: () => toast.error("Não foi possível revogar o convite."),
  });

  async function share(code: string) {
    const url = inviteUrl(code);
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: "Convite LobbyX", text: "Entre no meu servidor no LobbyX", url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy(url);
    toast.success("Link copiado para compartilhar.");
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Expira em</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Número de usos</Label>
              <Select value={maxUses} onValueChange={setMaxUses}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Gerando..." : "Gerar novo convite"}
          </Button>
        </div>
      )}

      <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
        {(invites ?? []).map((invite) => (
          <li key={invite.id} className="flex items-center gap-2 p-3">
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
              aria-label="Compartilhar convite"
              onClick={() => void share(invite.code)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
            {canCreate && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Revogar convite"
                onClick={() => revokeMutation.mutate(invite.id)}
              >
                <Trash2 className="text-destructive h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
        {(invites ?? []).length === 0 && (
          <li className="text-muted-foreground p-6 text-center text-sm">
            Nenhum convite ativo ainda.
          </li>
        )}
      </ul>
    </div>
  );
}
