import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminMutation } from "@/hooks/use-server-admin";
import { serverImagesService } from "@/services/server-images";
import { serversService } from "@/services/servers";
import type { Server } from "@/types";

export function SettingsProfile({ server, readOnly }: { server: Server; readOnly: boolean }) {
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? "");
  const [uploading, setUploading] = useState<"icon" | "banner" | null>(null);
  const iconInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const save = useAdminMutation(
    (patch: Partial<Server>) => serversService.update(server.id, patch),
    { success: "Servidor atualizado.", invalidate: [["servers"], ["audit-logs", server.id]] },
  );

  async function handleFile(kind: "icon" | "banner", file: File | undefined) {
    if (!file) return;
    setUploading(kind);
    try {
      const url = await serverImagesService.upload(server.id, kind, file);
      save.mutate(kind === "icon" ? { icon_url: url } : { banner_url: url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no upload.");
    } finally {
      setUploading(null);
    }
  }

  const dirty = name.trim() !== server.name || description.trim() !== (server.description ?? "");

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <Label className="text-xs">Banner do servidor</Label>
        <div
          className="border-border bg-surface-elevated relative flex h-32 items-end justify-end overflow-hidden rounded-xl border bg-cover bg-center"
          style={server.banner_url ? { backgroundImage: `url(${server.banner_url})` } : undefined}
        >
          {!server.banner_url && (
            <div className="bg-ambient absolute inset-0 grid place-items-center">
              <span className="text-muted-foreground text-xs">
                PNG, JPG, WEBP ou GIF animado (até 8 MB)
              </span>
            </div>
          )}
          {!readOnly && (
            <div className="relative z-10 flex gap-2 p-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bannerInput.current?.click()}
                disabled={uploading === "banner"}
              >
                {uploading === "banner" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                Enviar
              </Button>
              {server.banner_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Remover banner"
                  onClick={() => save.mutate({ banner_url: null })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
        <input
          ref={bannerInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile("banner", e.target.files?.[0])}
        />
      </section>

      <section className="flex items-center gap-4">
        <div
          className="border-border bg-surface-elevated grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-cover bg-center text-lg font-bold"
          style={server.icon_url ? { backgroundImage: `url(${server.icon_url})` } : undefined}
        >
          {!server.icon_url && server.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Ícone</Label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={readOnly || uploading === "icon"}
              onClick={() => iconInput.current?.click()}
            >
              {uploading === "icon" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Alterar ícone
            </Button>
            {server.icon_url && !readOnly && (
              <Button size="sm" variant="ghost" onClick={() => save.mutate({ icon_url: null })}>
                Remover
              </Button>
            )}
          </div>
        </div>
        <input
          ref={iconInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleFile("icon", e.target.files?.[0])}
        />
      </section>

      <section className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="server-name">
            Nome do servidor
          </Label>
          <Input
            id="server-name"
            value={name}
            maxLength={64}
            disabled={readOnly}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="server-description">
            Descrição
          </Label>
          <Textarea
            id="server-description"
            value={description}
            maxLength={500}
            rows={3}
            disabled={readOnly}
            placeholder="Conte do que se trata a comunidade"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Button
          disabled={readOnly || !dirty || !name.trim() || save.isPending}
          onClick={() =>
            save.mutate({ name: name.trim(), description: description.trim() || null })
          }
        >
          {save.isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </section>
    </div>
  );
}
