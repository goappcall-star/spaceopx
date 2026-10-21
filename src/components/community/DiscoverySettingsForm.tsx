import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateDiscoveryPayload } from "@/lib/community-discovery";
import { COMMUNITY_CATEGORIES } from "@/lib/community-validation";
import type { DiscoveryPayload, DiscoverySettings } from "@/types/community-discovery";
const blank: DiscoveryPayload = {
  name: "",
  description: "",
  icon_url: null,
  banner_url: null,
  category: "gaming",
  language: "",
  interests: [],
  public_rules: [],
  admission: "approval",
  consent: false,
};
export function DiscoverySettingsForm({
  data,
  serverName,
  busy,
  error,
  onSave,
}: {
  data: DiscoverySettings;
  serverName: string;
  busy: boolean;
  error: string | null;
  onSave: (p: DiscoveryPayload, revision: number, publish: boolean) => void;
}) {
  const [value, setValue] = useState<DiscoveryPayload>(() => ({
    ...blank,
    ...data.listing,
    name: data.listing?.name ?? serverName,
    consent: false,
  }));
  const [interests, setInterests] = useState(value.interests.join(", ")),
    [rules, setRules] = useState(value.public_rules.join("\n"));
  const input = "bg-background border-border mt-1 w-full rounded-lg border px-3 py-2 text-sm";
  function payload() {
    return validateDiscoveryPayload({
      ...value,
      interests: interests
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      public_rules: rules
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    });
  }
  function save(publish: boolean) {
    try {
      onSave(payload(), data.listing?.revision ?? 0, publish);
    } catch {
      toast.error(
        "Confira nome, descrição (20–3000 caracteres), imagens HTTPS, idioma, interesses e regras.",
      );
    }
  }
  return (
    <section className="space-y-4">
      <h3 className="font-semibold">Comunidade → Descoberta</h3>
      <p className="text-muted-foreground text-sm">
        Padrão: não listar publicamente. Só o proprietário pode divulgar esta apresentação. O
        conteúdo abaixo é independente das mensagens, canais e regras internas.
      </p>
      <p className="text-primary text-sm" role="status">
        {data.listing?.status === "listed"
          ? "Publicada no diretório"
          : data.listing?.status === "suspended"
            ? "Suspensa do diretório"
            : "Não listada publicamente"}
      </p>
      {!data.is_owner ? (
        <p className="text-muted-foreground text-sm">
          Você pode analisar solicitações abaixo. A publicação é exclusiva do proprietário.
        </p>
      ) : (
        <form
          className="border-border bg-surface space-y-4 rounded-xl border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <label className="block text-sm">
            Nome público
            <input
              className={input}
              value={value.name}
              maxLength={100}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Descrição pública
            <textarea
              className={input}
              rows={4}
              maxLength={3000}
              value={value.description}
              onChange={(e) => setValue({ ...value, description: e.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Ícone HTTPS (opcional)
              <input
                className={input}
                value={value.icon_url ?? ""}
                maxLength={2048}
                onChange={(e) => setValue({ ...value, icon_url: e.target.value || null })}
              />
            </label>
            <label className="block text-sm">
              Banner HTTPS (opcional)
              <input
                className={input}
                value={value.banner_url ?? ""}
                maxLength={2048}
                onChange={(e) => setValue({ ...value, banner_url: e.target.value || null })}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Categoria
              <select
                className={input}
                value={value.category}
                onChange={(e) => setValue({ ...value, category: e.target.value })}
              >
                {COMMUNITY_CATEGORIES.map((c) => (
                  <option value={c.value} key={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Idioma (opcional)
              <input
                className={input}
                placeholder="pt-br"
                value={value.language}
                maxLength={35}
                onChange={(e) => setValue({ ...value, language: e.target.value.toLowerCase() })}
              />
            </label>
          </div>
          <label className="block text-sm">
            Interesses públicos, separados por vírgula
            <input
              className={input}
              maxLength={410}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Regras públicas, uma por linha
            <textarea
              className={input}
              rows={4}
              maxLength={5010}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Forma de ingresso
            <select
              className={input}
              value={value.admission}
              onChange={(e) =>
                setValue({ ...value, admission: e.target.value as "direct" | "approval" })
              }
            >
              <option value="approval">Solicitação com aprovação</option>
              <option value="direct">Direto, sujeito às verificações do servidor</option>
            </select>
          </label>
          <p className="text-muted-foreground text-xs">
            Elegibilidade: comunidade ativa, proprietário autorizado, nome de 2–100 caracteres,
            descrição de 20–3000, categoria válida, ao menos uma regra pública e confirmação abaixo.
            A solicitação é aceita automaticamente quando esses critérios passam. Destaques e
            suspensão são reservados à operação confiável do diretório.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1 accent-primary"
              type="checkbox"
              checked={value.consent}
              onChange={(e) => setValue({ ...value, consent: e.target.checked })}
            />
            <span>
              Confirmo divulgar publicamente este nome, descrição, imagens, interesses e regras.
              Tenho autorização para usar as imagens.
            </span>
          </label>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={busy || !value.consent || data.listing?.status === "suspended"}
            >
              Solicitar publicação no diretório
            </Button>
            <Button variant="outline" type="button" disabled={busy} onClick={() => save(false)}>
              Salvar sem listar
            </Button>
            {data.listing?.status === "listed" && (
              <Button
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() =>
                  onSave(
                    { ...value, ...data.listing, consent: false },
                    data.listing!.revision,
                    false,
                  )
                }
              >
                Remover do diretório
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
