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
import { Textarea } from "@/components/ui/textarea";
import { serversService } from "@/services/servers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (serverId: string) => void;
}

export function CreateServerDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => serversService.create({ name, description, iconUrl }),
    onSuccess: async (serverId) => {
      await queryClient.invalidateQueries({ queryKey: ["servers"] });
      toast.success("Servidor criado com cargos e canal #geral.");
      setName("");
      setDescription("");
      setIconUrl("");
      onOpenChange(false);
      onCreated(serverId);
    },
    onError: () => toast.error("Não foi possível criar o servidor."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar servidor</DialogTitle>
          <DialogDescription>
            Cargos (Proprietário, Administrador, Membro) e o canal #geral são criados
            automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 2) {
              toast.error("O nome precisa ter ao menos 2 caracteres.");
              return;
            }
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="server-name">Nome</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Equipe de Segurança"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-description">Descrição</Label>
            <Textarea
              id="server-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para que serve este servidor?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-icon">Ícone (URL, opcional)</Label>
            <Input
              id="server-icon"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Criando..." : "Create Server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
