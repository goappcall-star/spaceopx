import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { serversService } from "@/services/servers";
import { serverDeletionErrorMessage } from "@/services/server-deletion-error";
import type { Server } from "@/types";

export function DeleteServerButton({
  server,
  onDeleted,
}: {
  server: Server;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const deletion = useMutation({
    mutationFn: () => serversService.remove(server.id),
    onSuccess: async () => {
      // Stop an older list request from restoring the deleted server in the UI.
      await queryClient.cancelQueries({ queryKey: ["servers"] });
      setOpen(false);
      onDeleted();
      queryClient.setQueryData<Server[]>(["servers"], (servers) =>
        servers?.filter((item) => item.id !== server.id),
      );
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
      toast.success("Servidor excluído.");
    },
    onError: (error) => {
      console.error("Falha ao excluir servidor", error);
      toast.error(serverDeletionErrorMessage(error));
    },
  });

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (deletion.isPending) return;
        setOpen(next);
        setName("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir servidor
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir {server.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é permanente. Os canais, mensagens, cargos e convites deste servidor serão
            excluídos, e todos os membros perderão o acesso.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="delete-server-name">
            Digite o nome do servidor para confirmar: {server.name}
          </Label>
          <Input
            id="delete-server-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={deletion.isPending}
            autoComplete="off"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={name !== server.name || deletion.isPending}
            onClick={() => deletion.mutate()}
          >
            {deletion.isPending ? "Excluindo..." : "Excluir servidor permanentemente"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
