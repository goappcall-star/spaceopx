import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MODULE_LABELS,
  selectableCommunityRole,
  validateExperience,
} from "@/lib/community-experience";
import type { CommunityExperience, CommunityExperienceConfig } from "@/types/community-experience";
import type { Channel, Role } from "@/types";
export function CommunityCustomizationForm({
  initial,
  channels,
  roles,
  conflict,
  onSave,
  onCancel,
  onUpload,
}: {
  initial: CommunityExperience;
  channels: Channel[];
  roles: Role[];
  conflict: boolean;
  onSave: (config: CommunityExperienceConfig) => Promise<void>;
  onCancel: () => void;
  onUpload?: ((file: File) => Promise<string>) | undefined;
}) {
  const [draft, setDraft] = useState(() => structuredClone(initial.experience)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function patch<K extends keyof CommunityExperienceConfig>(
    key: K,
    value: CommunityExperienceConfig[K],
  ) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((v) => v !== id) : [...arr, id];
  async function save() {
    if (busy || conflict) return;
    setBusy(true);
    setError("");
    try {
      await onSave(validateExperience(draft));
      onCancel();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h3 className="text-lg font-semibold">Home e boas-vindas</h3>
      <p className="text-xs text-muted-foreground">
        Estas preferências usam o mesmo servidor. Avisos editoriais são visíveis aos membros; não
        copie conteúdo de canais privados.
      </p>
      {conflict && (
        <p role="alert" className="text-sm text-destructive">
          A configuração mudou ou não pôde ser revalidada. Cancele e reabra antes de salvar.
        </p>
      )}
      <fieldset disabled={busy} className="space-y-5">
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.home_enabled}
            onChange={(e) => patch("home_enabled", e.target.checked)}
            className="accent-primary"
          />
          Mostrar página inicial da comunidade
        </label>
        <div className="space-y-2">
          <Label htmlFor="community-intro">Texto de apresentação</Label>
          <textarea
            id="community-intro"
            value={draft.intro}
            maxLength={2000}
            onChange={(e) => patch("intro", e.target.value)}
            className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="community-home-banner">Banner da Home (HTTPS)</Label>
          <Input
            id="community-home-banner"
            value={draft.banner_url ?? ""}
            placeholder="Em branco: usar banner atual do servidor"
            onChange={(e) => patch("banner_url", e.target.value || null)}
          />
          {onUpload && (
            <label className="block text-xs text-muted-foreground">
              Enviar imagem de até 8 MB
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Enviar banner da Home"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  void onUpload(f)
                    .then((url) => patch("banner_url", url))
                    .catch((err) =>
                      setError(err instanceof Error ? err.message : "Falha no upload."),
                    )
                    .finally(() => setBusy(false));
                }}
              />
            </label>
          )}
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Ordem dos módulos</h4>
          {draft.modules.map((m, i) => (
            <div
              key={m}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span className="flex-1 text-sm">{MODULE_LABELS[m]}</span>
              {([-1, 1] as const).map((dir) => (
                <Button
                  key={dir}
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={(dir < 0 ? "Subir " : "Descer ") + MODULE_LABELS[m]}
                  disabled={i + dir < 0 || i + dir >= draft.modules.length}
                  onClick={() => {
                    const next = [...draft.modules];
                    [next[i], next[i + dir]] = [next[i + dir]!, next[i]!];
                    patch("modules", next);
                  }}
                >
                  {dir < 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </Button>
              ))}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Avisos fixados</h4>
          {draft.notices.map((n, i) => (
            <div key={n.id} className="space-y-2 rounded-xl border border-border p-3">
              <Input
                aria-label={"Título do aviso " + (i + 1)}
                maxLength={100}
                value={n.title}
                placeholder="Título"
                onChange={(e) =>
                  patch(
                    "notices",
                    draft.notices.map((x) => (x.id === n.id ? { ...x, title: e.target.value } : x)),
                  )
                }
              />
              <textarea
                aria-label={"Texto do aviso " + (i + 1)}
                maxLength={2000}
                value={n.body}
                placeholder="Texto para todos os membros"
                onChange={(e) =>
                  patch(
                    "notices",
                    draft.notices.map((x) => (x.id === n.id ? { ...x, body: e.target.value } : x)),
                  )
                }
                className="min-h-20 w-full rounded-lg border border-border bg-background p-3 text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  patch(
                    "notices",
                    draft.notices.filter((x) => x.id !== n.id),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
                Remover aviso
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={draft.notices.length >= 5}
            onClick={() =>
              patch("notices", [...draft.notices, { id: crypto.randomUUID(), title: "", body: "" }])
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar aviso
          </Button>
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Canais em destaque e sugestões (até 10)</h4>
          {channels.map((c) => (
            <label key={c.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.featured_channels.includes(c.id)}
                onChange={() => patch("featured_channels", toggle(draft.featured_channels, c.id))}
                className="accent-primary"
              />
              # {c.name}
            </label>
          ))}
        </div>
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">Etapas de boas-vindas</h4>
          {(
            [
              ["welcome_enabled", "Mensagem de boas-vindas"],
              ["rules_enabled", "Apresentar regras"],
              ["rules_required", "Exigir aceite das regras"],
              ["interests_enabled", "Seleção opcional de interesses"],
              ["channels_enabled", "Sugestão de canais"],
              ["roles_enabled", "Seleção opcional de cargos"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft[k]}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    [k]: e.target.checked,
                    ...(k === "rules_enabled" && !e.target.checked
                      ? { rules_required: false }
                      : {}),
                    ...(k === "rules_required" && e.target.checked ? { rules_enabled: true } : {}),
                  }))
                }
                className="accent-primary"
              />
              {label}
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            O aceite obrigatório impede novos membros de enviar mensagens e reações até aceitar a
            revisão atual. Membros anteriores à habilitação e chamadas de voz mantêm seu
            funcionamento. Etapas opcionais podem ser puladas.
          </p>
          <Label htmlFor="community-welcome-text">Mensagem de boas-vindas</Label>
          <textarea
            id="community-welcome-text"
            value={draft.welcome_text}
            maxLength={2000}
            onChange={(e) => patch("welcome_text", e.target.value)}
            className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Cargos permitidos (até 10)</h4>
          <p className="text-xs text-muted-foreground">
            Somente cargos sem privilégios administrativos, de moderação, convites ou permissões
            desconhecidas. Alterações são revalidadas pelo banco.
          </p>
          {roles.filter(selectableCommunityRole).map((r) => (
            <label key={r.id} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.role_ids.includes(r.id)}
                onChange={() => patch("role_ids", toggle(draft.role_ids, r.id))}
                className="accent-primary"
              />
              {r.name}
            </label>
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={busy || conflict}>{busy ? "Salvando…" : "Salvar personalização"}</Button>
      </div>
    </form>
  );
}
