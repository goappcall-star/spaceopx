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
} from "@/components/ui/dialog";
import type { Channel, ServerCategory } from "@/types";
function CategoryRow({
  category,
  busy,
  run,
}: {
  category: ServerCategory;
  busy: boolean;
  run: (operation: () => Promise<unknown>) => void;
}) {
  const [name, setName] = useState(category.name);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
      <Input
        aria-label={`Nome da categoria ${category.name}`}
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        className="min-w-0 flex-1"
      />
      <Button
        size="sm"
        disabled={busy || !name.trim() || name.trim() === category.name}
        onClick={() => run(() => categoriesService.rename(category.server_id, category.id, name))}
      >
        Salvar nome
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={busy}
        onClick={() => {
          if (
            window.confirm(
              `Excluir a categoria "${category.name}"? Os canais serão mantidos sem categoria.`,
            )
          )
            run(() => categoriesService.remove(category.server_id, category.id));
        }}
      >
        Excluir
      </Button>
    </div>
  );
}
export function CategoryManager({
  serverId,
  categories,
  channels,
  open,
  onOpenChange,
}: {
  serverId: string;
  categories: ServerCategory[];
  channels: Channel[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      await Promise.all([
        client.invalidateQueries({ queryKey: ["categories", serverId] }),
        client.invalidateQueries({ queryKey: ["channels", serverId] }),
      ]);
      toast.success("Estrutura atualizada.");
    } catch {
      toast.error(
        "Não foi possível atualizar. Confira sua permissão de gerenciar canais e se a atualização do banco foi aplicada.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Categorias do servidor</DialogTitle>
          <DialogDescription>
            Organize os canais. Excluir uma categoria mantém seus canais sem categoria.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await categoriesService.create(
                serverId,
                name,
                Math.max(-1, ...categories.map((c) => c.position)) + 1,
              );
              setName("");
            });
          }}
          className="space-y-2"
        >
          <Label htmlFor="category-name">Nova categoria</Label>
          <div className="flex gap-2">
            <Input
              id="category-name"
              maxLength={80}
              placeholder="Ex.: Jogos"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={busy || !name.trim()}>
              Criar
            </Button>
          </div>
        </form>
        <div className="space-y-2">
          {categories.map((category) => (
            <CategoryRow
              key={category.id + category.name}
              category={category}
              busy={busy}
              run={(operation) => void run(operation)}
            />
          ))}
        </div>
        <h3 className="text-sm font-semibold">Categoria de cada canal</h3>
        <div className="space-y-3">
          {channels.map((channel) => (
            <div key={channel.id} className="flex items-center gap-3">
              <Label htmlFor={`category-${channel.id}`} className="min-w-0 flex-1 truncate">
                {channel.type === "voice" ? "🔊" : "#"} {channel.name}
              </Label>
              <select
                id={`category-${channel.id}`}
                value={channel.category_id ?? ""}
                disabled={busy}
                onChange={(e) =>
                  void run(() =>
                    categoriesService.assignChannel(serverId, channel.id, e.target.value || null),
                  )
                }
                className="border-input bg-background h-9 max-w-[60%] rounded-md border px-2 text-sm"
              >
                <option value="">Sem categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
