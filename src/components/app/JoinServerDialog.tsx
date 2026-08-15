import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitesService, inviteErrorMessage } from "@/services/invites";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (serverId: string) => void;
}

/** Accepts a raw code or a full /invite/<code> URL. */
function extractCode(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/invite\/([A-Za-z0-9_-]+)/);
  return (match?.[1] ?? trimmed).toLowerCase();
}

export function JoinServerDialog({ open, onOpenChange, onJoined }: Props) {
  const [code, setCode] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => invitesService.join(extractCode(code)),
    onSuccess: async (serverId) => {
      await queryClient.invalidateQueries();
      toast.success("Você entrou no servidor.");
      setCode("");
      onOpenChange(false);
      onJoined(serverId);
    },
    onError: (error) => toast.error(inviteErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrar em servidor</DialogTitle>
          <DialogDescription>Cole o código ou o link do convite.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!code.trim()) return;
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-code">Código do convite</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="a1b2c3d4e5f6"
              className="font-mono"
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
