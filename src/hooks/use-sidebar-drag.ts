import { useRef, useState, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { categoriesService } from "@/services/categories";
import { reorderCategoryIds } from "@/lib/sidebar-drag";
import type { Channel, ServerCategory } from "@/types";
type Source = { kind: "channel" | "category"; id: string };
type Target = { id: string | null; after: boolean };
export function useSidebarDrag(
  serverId: string,
  canManage: boolean,
  channels: Channel[],
  categories: ServerCategory[],
  expand: (id: string) => void,
) {
  const client = useQueryClient();
  const [source, setSource] = useState<Source | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const suppressClickUntil = useRef(0);
  const [announcement, setAnnouncement] = useState("");
  function start(event: DragEvent<HTMLElement>, kind: Source["kind"], id: string) {
    if (!canManage || savingRef.current) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setSource({ kind, id });
    setAnnouncement(
      kind === "channel"
        ? "Arrastando canal de voz. Solte sobre uma categoria."
        : "Arrastando categoria. Solte acima ou abaixo de outra categoria.",
    );
  }
  function finish() {
    setSource(null);
    setTarget(null);
    suppressClickUntil.current = Date.now() + 350;
  }
  function canDrop(id: string | null) {
    return (
      canManage &&
      !savingRef.current &&
      !!source &&
      (source.kind === "channel" || (id !== null && source.id !== id))
    );
  }
  function over(event: DragEvent<HTMLElement>, id: string | null) {
    if (!canDrop(id)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    const header =
      event.currentTarget.querySelector("[data-category-header]") ?? event.currentTarget;
    const rect = header.getBoundingClientRect();
    setTarget({ id, after: event.clientY > rect.top + rect.height / 2 });
    const scrollArea = event.currentTarget.closest("[data-testid='channel-sidebar-space']");
    if (scrollArea) {
      const bounds = scrollArea.getBoundingClientRect();
      if (event.clientY < bounds.top + 40) scrollArea.scrollTop -= 14;
      else if (event.clientY > bounds.bottom - 40) scrollArea.scrollTop += 14;
    }
  }
  async function drop(event: DragEvent<HTMLElement>, id: string | null) {
    if (!canDrop(id) || !source) return;
    event.preventDefault();
    event.stopPropagation();
    const dragged = source;
    const header =
      event.currentTarget.querySelector("[data-category-header]") ?? event.currentTarget;
    const rect = header.getBoundingClientRect(),
      after = event.clientY > rect.top + rect.height / 2;
    finish();
    savingRef.current = true;
    setSaving(true);
    try {
      if (dragged.kind === "channel") {
        const channel = channels.find((item) => item.id === dragged.id && item.type === "voice");
        if (!channel || (id !== null && !categories.some((category) => category.id === id)))
          throw Error("Invalid drop");
        if (channel.category_id !== id)
          await categoriesService.assignChannel(serverId, channel.id, id);
        expand(id ?? "");
        const label =
          categories.find((category) => category.id === id)?.name ?? "Canais de voz sem categoria";
        setAnnouncement(`Canal ${channel.name} movido para ${label}.`);
      } else {
        // Use fresh rows so a concurrent rename is not overwritten by the reorder.
        const current = await categoriesService.list(serverId);
        if (
          !id ||
          !current.some((category) => category.id === id) ||
          !current.some((category) => category.id === dragged.id)
        )
          throw Error("Invalid category");
        const ids = reorderCategoryIds(
          current.map((category) => category.id),
          dragged.id,
          id,
          after,
        );
        await categoriesService.reorder(
          serverId,
          ids.map((categoryId) => current.find((category) => category.id === categoryId)!),
        );
        setAnnouncement("Posição das categorias atualizada.");
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ["categories", serverId] }),
        client.invalidateQueries({ queryKey: ["channels", serverId] }),
      ]);
    } catch {
      toast.error("Não foi possível mover. Confira sua permissão de gerenciar canais.");
      setAnnouncement("Não foi possível salvar a movimentação.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const zone = (id: string | null) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => over(event, id),
    onDrop: (event: DragEvent<HTMLElement>) => {
      void drop(event, id);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
    },
  });
  const draggable = (kind: Source["kind"], id: string) => ({
    draggable: canManage && !saving,
    onDragStart: (event: DragEvent<HTMLElement>) => start(event, kind, id),
    onDragEnd: finish,
  });
  return {
    source,
    target,
    saving,
    announcement,
    zone,
    draggable,
    suppressClick: () => Date.now() < suppressClickUntil.current,
  };
}
