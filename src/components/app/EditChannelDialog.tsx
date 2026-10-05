import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Channel } from "@/types";
import { channelsService } from "@/services/channels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
export function EditChannelDialog({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState(channel.name),
    [description, setDescription] = useState(channel.description ?? ""),
    [busy, setBusy] = useState(false);
  async function submit() {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      await channelsService.update(channel.server_id, channel.id, name, description);
      await client.invalidateQueries({ queryKey: ["channels", channel.server_id] });
      onClose();
      toast.success("Canal atualizado.");
    } catch {
      toast.error("Não foi possível salvar o canal. Confira sua permissão de gerenciar canais.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar canal</DialogTitle>
          <DialogDescription>Atualize o nome e a descrição do canal.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-channel-name">Nome do canal</Label>
            <Input
              id="edit-channel-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-channel-description">Descrição</Label>
            <Input
              id="edit-channel-description"
              value={description}
              maxLength={500}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button disabled={busy || !name.trim()}>{busy ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
