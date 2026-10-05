import { useQuery, useQueryClient } from "@tanstack/react-query";
import { categoriesService } from "@/services/categories";
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
import { channelsService } from "@/services/channels";
import { cn } from "@/lib/utils";
import type { ChannelType } from "@/types";

interface Props {
  serverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: ChannelType;
  defaultCategoryId?: string;
  onCreated?: (channelId: string) => void;
}

export function CreateChannelDialog({
  serverId,
  open,
  onOpenChange,
  defaultType = "text",
  defaultCategoryId = "",
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChannelType>(defaultType);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const { data: categories = [] } = useQuery({
    queryKey: ["categories", serverId],
    queryFn: () => categoriesService.list(serverId),
    enabled: open,
  });
  const queryClient = useQueryClient();

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const channel = await channelsService.create(serverId, name, type, categoryId || null);
      await queryClient.invalidateQueries({ queryKey: ["channels", serverId] });
      onCreated?.(channel.id);
      onOpenChange(false);
      setName("");
      toast.success("Canal criado.");
    } catch (error) {
      toast.error((error as Error).message ?? "Não foi possível criar o canal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar canal</DialogTitle>
          <DialogDescription>Escolha o tipo e o nome do novo canal.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {(["text", "voice"] as ChannelType[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-colors",
                type === option
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:border-primary/40",
              )}
            >
              <span className="block font-semibold">
                {option === "text" ? "# Texto" : "🔊 Voz"}
              </span>
              <span className="text-xs">
                {option === "text" ? "Mensagens e anexos" : "Conversa por áudio"}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="channel-name">Nome do canal</Label>
          <Input
            id="channel-name"
            value={name}
            placeholder={type === "text" ? "estrategias" : "sala-de-jogo"}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void submit()}
          />
        </div>

        <DialogFooter>
          <div className="mr-auto space-y-1">
            <Label htmlFor="new-channel-category">Categoria</Label>
            <select
              id="new-channel-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            >
              <option value="">Sem categoria</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving ? "Criando..." : "Criar canal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
