import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoriesService } from "@/services/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ServerCategory } from "@/types";
export function CategoryManager({
  serverId,
  categories,
  category,
  onOpenChange,
}: {
  serverId: string;
  categories: ServerCategory[];
  category?: ServerCategory | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(category?.name ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      if (category) await categoriesService.rename(serverId, category.id, name);
      else
        await categoriesService.create(
          serverId,
          name,
          Math.max(-1, ...categories.map((c) => c.position)) + 1,
        );
      await client.invalidateQueries({ queryKey: ["categories", serverId] });
      onOpenChange(false);
      toast.success(category ? "Categoria atualizada." : "Categoria criada.");
    } catch {
      toast.error(
        "Não foi possível salvar a categoria. Confira sua permissão de gerenciar canais.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Criar categoria"}</DialogTitle>
          <DialogDescription>Defina o nome da categoria do servidor.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome da categoria</Label>
            <Input
              id="category-name"
              autoFocus
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Jogos"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button disabled={busy || !name.trim()}>
              {busy ? "Salvando…" : category ? "Salvar" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
