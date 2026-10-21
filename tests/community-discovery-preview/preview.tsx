import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import {
  CommunityDiscoveryView,
  CommunityPresentationView,
} from "@/components/community/CommunityDiscoveryView";
import { DiscoverySettingsForm } from "@/components/community/DiscoverySettingsForm";
import { emptyDiscoveryFilters } from "@/lib/community-discovery";
import type {
  DiscoverySettings,
  CommunityPresentation,
  PublicCommunity,
  DiscoveryPayload,
} from "@/types/community-discovery";
import "../../src/styles.css";
const stamp = "2026-10-21T12:00:00Z";
const fixture: PublicCommunity = {
  server_id: "cd000000-0000-0000-0000-000000000001",
  name: "Órbita Cooperativa · exemplo local",
  description:
    "Comunidade fictícia para avaliar a descoberta do LobbyX. Encontros cooperativos, tecnologia e boas conversas, somente nesta prévia.",
  icon_url: "/lobbyx-logo.png",
  banner_url: "/auth/lobbyx-city-v1.webp",
  category: "gaming",
  language: "pt-br",
  interests: ["coop", "tecnologia"],
  public_rules: ["Respeite as pessoas e os canais.", "Não envie spam ou dados pessoais."],
  admission: "approval",
  published_at: stamp,
  featured: false,
};
export function DiscoveryPreview() {
  const [tab, setTab] = useState<"explore" | "settings">("explore"),
    [filters, setFilters] = useState(emptyDiscoveryFilters),
    [items, setItems] = useState<PublicCommunity[]>([]),
    [selected, setSelected] = useState<CommunityPresentation | null>(null),
    [config, setConfig] = useState<DiscoverySettings>({ is_owner: true, listing: null }),
    [error, setError] = useState<string | null>(null),
    [loading, setLoading] = useState(false),
    [recent, setRecent] = useState<string[]>([]);
  const page = items.filter(
    (i) =>
      (!filters.search || i.name.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.category || i.category === filters.category) &&
      (!filters.language || i.language === filters.language) &&
      (!filters.interest || i.interests.includes(filters.interest)),
  );
  function open(id: string) {
    const item = items.find((i) => i.server_id === id);
    if (item) {
      setSelected({ ...item, revision: 1, my_membership: false, can_join: true, my_request: null });
      setRecent((ids) => [id, ...ids.filter((i) => i !== id)].slice(0, 3));
    }
  }
  function save(p: DiscoveryPayload, r: number, publish: boolean) {
    const item = { ...p, server_id: fixture.server_id, published_at: stamp, featured: false };
    setConfig({
      is_owner: true,
      listing: { ...item, status: publish ? "listed" : "unlisted", revision: r + 1 },
    });
    setItems(publish ? [item] : []);
    setTab("explore");
    setSelected(null);
  }
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="border-border text-muted-foreground border-b p-3 text-xs">
        PRÉVIA LOCAL · dados fictícios identificados · callbacks em memória · sem Supabase, login ou
        publicação
      </div>
      <nav className="border-border flex flex-wrap gap-2 border-b p-3">
        {(["explore", "settings"] as const).map((t) => (
          <button
            className="bg-primary/10 text-primary rounded-lg px-3 py-2 text-sm"
            key={t}
            onClick={() => {
              setTab(t);
              setSelected(null);
            }}
          >
            {t === "explore" ? "Explorar" : "Proprietário → Descoberta"}
          </button>
        ))}
        <button
          className="rounded-lg border px-3 text-xs"
          onClick={() => {
            setItems([fixture]);
            setError(null);
          }}
        >
          Carregar exemplo fictício
        </button>
        <button
          className="rounded-lg border px-3 text-xs"
          onClick={() => {
            setItems([]);
            setSelected(null);
          }}
        >
          Esvaziar
        </button>
        <button
          className="rounded-lg border px-3 text-xs"
          onClick={() =>
            setError(error ? null : "Falha simulada de conexão, somente nesta prévia.")
          }
        >
          Simular erro
        </button>
        <button className="rounded-lg border px-3 text-xs" onClick={() => setLoading(!loading)}>
          Alternar carregamento
        </button>
      </nav>
      {tab === "settings" ? (
        <div className="mx-auto max-w-3xl p-6">
          <DiscoverySettingsForm
            key={config.listing?.revision ?? 0}
            data={config}
            serverName="Squad local"
            busy={false}
            error={null}
            onSave={save}
          />
        </div>
      ) : selected ? (
        <CommunityPresentationView
          item={selected}
          busy={false}
          error={null}
          onBack={() => setSelected(null)}
          onJoin={() =>
            setSelected({ ...selected, my_request: { status: "pending", revision: 1 } })
          }
          onWithdraw={() =>
            setSelected({ ...selected, my_request: { status: "withdrawn", revision: 2 } })
          }
          onEnter={() => {}}
        />
      ) : (
        <CommunityDiscoveryView
          filters={filters}
          onFilters={setFilters}
          page={{ items: page, has_more: false }}
          featured={[]}
          recent={items.filter((i) => recent.includes(i.server_id))}
          loading={loading}
          error={error}
          onRetry={() => setError(null)}
          onOpen={open}
          onFirst={() => {}}
          onNext={() => {}}
        />
      )}
      <Toaster theme="dark" />
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<DiscoveryPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
