import { Globe2 } from "lucide-react";
import {
  CommunityHeading,
  CommunitySection,
  CommunityCover,
  CommunityNotice,
  CommunityActions,
} from "./CommunityUI";
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
    <section className="community-ui space-y-5">
      <CommunityHeading
        icon={Globe2}
        eyebrow="Explorar Comunidades"
        title="Abra as portas para novas conexões"
        description="Crie a apresentação pública do seu servidor. Mensagens e canais privados permanecem fora do diretório."
      >
        <span
          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
          role="status"
        >
          {data.listing?.status === "listed"
            ? "Publicada no diretório"
            : data.listing?.status === "suspended"
              ? "Suspensa do diretório"
              : "Não listada publicamente"}
        </span>
      </CommunityHeading>
      {!data.is_owner ? (
        <CommunityNotice>
          Você pode analisar solicitações abaixo. A publicação é exclusiva do proprietário.
        </CommunityNotice>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          <div className="community-editor-grid">
            <div className="space-y-4">
              <CommunitySection
                title="A primeira impressão"
                description="As pessoas verão estas informações antes de pedir para entrar."
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
                <label className="mt-4 block text-sm">
                  Descrição pública
                  <textarea
                    className={input}
                    rows={4}
                    maxLength={3000}
                    value={value.description}
                    placeholder="Conte o que une sua comunidade e quem vai se sentir em casa aqui."
                    onChange={(e) => setValue({ ...value, description: e.target.value })}
                  />
                </label>
                <details className="mt-4 border-t border-border">
                  <summary>Imagens da apresentação</summary>
                  <div className="space-y-3">
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
                    <p className="text-xs text-muted-foreground">
                      Use imagens que você pode divulgar publicamente. A prévia não envia arquivos.
                    </p>
                  </div>
                </details>
              </CommunitySection>
              <CommunitySection
                title="Encontre as pessoas certas"
                description="Categoria, idioma e interesses ajudam a reconhecer o seu espaço."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    Categoria
                    <select
                      className={input}
                      value={value.category}
                      onChange={(e) => setValue({ ...value, category: e.target.value })}
                    >
                      {COMMUNITY_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
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
                      onChange={(e) =>
                        setValue({ ...value, language: e.target.value.toLowerCase() })
                      }
                    />
                  </label>
                </div>
                <label className="mt-4 block text-sm">
                  Interesses públicos, separados por vírgula
                  <input
                    className={input}
                    maxLength={410}
                    value={interests}
                    placeholder="Coop, tecnologia, criação…"
                    onChange={(e) => setInterests(e.target.value)}
                  />
                </label>
              </CommunitySection>
              <CommunitySection
                title="Uma entrada com contexto"
                description="Explique as regras públicas e como novos membros podem participar."
              >
                <label className="block text-sm">
                  Regras públicas, uma por linha
                  <textarea
                    className={input}
                    rows={3}
                    maxLength={5010}
                    value={rules}
                    onChange={(e) => setRules(e.target.value)}
                  />
                </label>
                <label className="mt-4 block text-sm">
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
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {value.admission === "approval"
                    ? "Um gestor autorizado analisa cada solicitação antes da entrada."
                    : "A entrada ainda respeita as verificações e os banimentos do servidor."}
                </p>
              </CommunitySection>
            </div>
            <aside className="community-editor-preview space-y-3" aria-label="Prévia pública">
              <p className="community-eyebrow">Sua comunidade no Explorar</p>
              <CommunityCover
                src={value.banner_url}
                title={value.name || "Nome da comunidade"}
                description={
                  value.description || "Uma boa apresentação começa pelo que aproxima as pessoas."
                }
              >
                <div className="flex flex-wrap gap-2 pt-2 text-xs text-muted-foreground">
                  <span className="rounded-md border border-border px-2 py-1">
                    {COMMUNITY_CATEGORIES.find((c) => c.value === value.category)?.label ??
                      "Categoria"}
                  </span>
                  {value.language && (
                    <span className="rounded-md border border-border px-2 py-1">
                      {value.language}
                    </span>
                  )}
                </div>
                <p className="pt-2 text-xs text-primary">
                  {value.admission === "approval"
                    ? "Entrada sujeita a aprovação"
                    : "Entrada sujeita às verificações"}
                </p>
              </CommunityCover>
              <CommunityNotice>
                A prévia não publica sua comunidade. A publicação exige sua confirmação abaixo.
              </CommunityNotice>
            </aside>
          </div>
          <div className="mt-5 space-y-4">
            <CommunityNotice>
              É necessário ter uma comunidade ativa, descrição de 20–3000 caracteres, categoria e ao
              menos uma regra pública. Quando os critérios passam, a publicação é aceita
              automaticamente. Destaques e suspensão pertencem à operação oficial do diretório.
            </CommunityNotice>
            <label className="community-choice text-sm">
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
            {error && <CommunityNotice tone="error">{error}</CommunityNotice>}
          </div>
          <CommunityActions>
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
            <Button variant="outline" type="button" disabled={busy} onClick={() => save(false)}>
              Salvar sem listar
            </Button>
            <Button
              type="submit"
              disabled={busy || !value.consent || data.listing?.status === "suspended"}
            >
              <Globe2 aria-hidden="true" className="h-4 w-4" />
              {busy ? "Salvando…" : "Solicitar publicação no diretório"}
            </Button>
          </CommunityActions>
        </form>
      )}
    </section>
  );
}
