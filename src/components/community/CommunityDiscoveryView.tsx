import { Compass, ArrowLeft, Search, ShieldCheck, Users, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMUNITY_CATEGORIES } from "@/lib/community-validation";
import type {
  CommunityPresentation,
  DiscoveryFilters,
  DiscoveryPage,
  PublicCommunity,
} from "@/types/community-discovery";
export function CommunityDiscoveryCard({
  item,
  onOpen,
}: {
  item: PublicCommunity;
  onOpen: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item.server_id)}
      className="bg-surface border-border hover:border-primary/60 overflow-hidden rounded-2xl border text-left focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="bg-primary/10 h-28 overflow-hidden">
        {item.banner_url && (
          <img
            src={item.banner_url}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.hidden = true;
            }}
          />
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-3">
          <img
            src={item.icon_url ?? "/lobbyx-logo.png"}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/lobbyx-logo.png";
            }}
            referrerPolicy="no-referrer"
            loading="lazy"
            alt=""
            className="h-10 w-10 rounded-xl object-cover"
          />
          <h3 className="min-w-0 flex-1 truncate font-semibold">{item.name}</h3>
          <ArrowUpRight className="text-primary h-4 w-4" />
        </div>
        <p className="text-muted-foreground line-clamp-2 min-h-10 text-sm break-words">
          {item.description}
        </p>
        <div className="text-muted-foreground flex flex-wrap gap-2 text-xs">
          <span>{COMMUNITY_CATEGORIES.find((c) => c.value === item.category)?.label}</span>
          {item.language && <span>· {item.language}</span>}
        </div>
        <p className="text-primary flex items-center gap-2 text-xs">
          <ShieldCheck className="h-3.5 w-3.5" />
          {item.admission === "direct" ? "Ingresso disponível" : "Entrada sujeita a aprovação"}
        </p>
      </div>
    </button>
  );
}
export function CommunityDiscoveryView({
  filters,
  onFilters,
  page,
  featured,
  recent,
  loading,
  error,
  onRetry,
  onOpen,
  onNext,
  onFirst,
}: {
  filters: DiscoveryFilters;
  onFilters: (f: DiscoveryFilters) => void;
  page: DiscoveryPage | undefined;
  featured: PublicCommunity[];
  recent: PublicCommunity[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onNext: () => void;
  onFirst: () => void;
}) {
  return (
    <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
      <header className="mb-7 flex items-start gap-3">
        <Compass className="text-primary mt-1 h-7 w-7" />
        <div>
          <p className="text-muted-foreground text-xs">Seu próximo ponto de encontro</p>
          <h1 className="text-2xl font-bold">Explorar Comunidades</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Encontre pessoas com os mesmos interesses. Conheça as regras antes de participar.
          </p>
        </div>
      </header>
      <form
        className="bg-surface border-border mb-6 space-y-4 rounded-2xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onFirst();
          onRetry();
        }}
      >
        <label className="flex items-center gap-2">
          <Search className="text-primary h-5 w-5" />
          <span className="sr-only">Pesquisar comunidades</span>
          <input
            className="bg-background border-border h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm"
            placeholder="Pesquisar por nome ou descrição…"
            maxLength={100}
            value={filters.search}
            onChange={(e) => onFilters({ ...filters, search: e.target.value })}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-muted-foreground text-xs">
            Categoria
            <select
              className="bg-background border-border mt-1 h-10 w-full rounded-lg border px-2 text-sm"
              value={filters.category}
              onChange={(e) => onFilters({ ...filters, category: e.target.value })}
            >
              <option value="">Todas as categorias</option>
              {COMMUNITY_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-muted-foreground text-xs">
            Idioma
            <input
              className="bg-background border-border mt-1 h-10 w-full rounded-lg border px-3 text-sm"
              placeholder="Ex.: pt-br"
              maxLength={35}
              value={filters.language}
              onChange={(e) => onFilters({ ...filters, language: e.target.value.toLowerCase() })}
            />
          </label>
          <label className="text-muted-foreground text-xs">
            Interesse
            <input
              className="bg-background border-border mt-1 h-10 w-full rounded-lg border px-3 text-sm"
              placeholder="Ex.: coop"
              maxLength={40}
              value={filters.interest}
              onChange={(e) => onFilters({ ...filters, interest: e.target.value.toLowerCase() })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {COMMUNITY_CATEGORIES.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={filters.category === c.value ? "default" : "outline"}
              onClick={() =>
                onFilters({ ...filters, category: filters.category === c.value ? "" : c.value })
              }
            >
              {c.label}
            </Button>
          ))}
        </div>
      </form>
      {!error && featured.length > 0 && (
        <DiscoverySection title="Em destaque" items={featured} onOpen={onOpen} />
      )}
      {!error && recent.length > 0 && (
        <DiscoverySection title="Você conheceu nesta sessão" items={recent} onOpen={onOpen} />
      )}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Comunidades públicas</h2>
        <Button variant="ghost" size="sm" onClick={onFirst}>
          Início da lista
        </Button>
      </div>
      {error ? (
        <div role="alert" className="border-destructive/30 space-y-3 rounded-xl border p-5">
          <p>{error}</p>
          <Button variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : loading ? (
        <p role="status" className="text-muted-foreground py-10">
          Buscando comunidades…
        </p>
      ) : page?.items.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {page.items.map((item) => (
            <CommunityDiscoveryCard key={item.server_id} item={item} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed p-9 text-center">
          <Users className="mx-auto mb-3 h-8 w-8" />
          <p>Nenhuma comunidade encontrada.</p>
          <p className="mt-2 text-xs">
            Tente outro interesse ou volte mais tarde. Só aparecem comunidades publicadas pelo
            proprietário.
          </p>
        </div>
      )}
      {page?.has_more && !loading && !error && (
        <Button className="mt-5" variant="outline" onClick={onNext}>
          Próxima página
        </Button>
      )}
    </section>
  );
}
function DiscoverySection({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: PublicCommunity[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="mb-7">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <CommunityDiscoveryCard key={item.server_id} item={item} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}
export function CommunityPresentationView({
  item,
  busy,
  error,
  onBack,
  onJoin,
  onWithdraw,
  onEnter,
}: {
  item: CommunityPresentation;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onJoin: () => void;
  onWithdraw: () => void;
  onEnter: () => void;
}) {
  return (
    <section className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-7">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" />
        Explorar
      </Button>
      <article className="bg-surface border-border mx-auto mt-4 max-w-4xl overflow-hidden rounded-2xl border">
        <div className="bg-primary/10 h-40 sm:h-56">
          {item.banner_url && (
            <img
              src={item.banner_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.hidden = true;
              }}
            />
          )}
        </div>
        <div className="space-y-6 p-5 sm:p-8">
          <div className="flex items-center gap-3">
            <img
              src={item.icon_url ?? "/lobbyx-logo.png"}
              alt=""
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-xl object-cover"
              onError={(e) => {
                e.currentTarget.src = "/lobbyx-logo.png";
              }}
            />
            <h1 className="text-2xl font-bold">{item.name}</h1>
          </div>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">
            {item.description}
          </p>
          <p className="text-primary text-xs">
            {COMMUNITY_CATEGORIES.find((c) => c.value === item.category)?.label}
            {item.language ? ` · ${item.language}` : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {item.interests.map((i) => (
              <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs" key={i}>
                {i}
              </span>
            ))}
          </div>
          <section>
            <h2 className="mb-3 font-semibold">Regras públicas</h2>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              {item.public_rules.map((r, i) => (
                <li key={i} className="whitespace-pre-wrap break-words">
                  {r}
                </li>
              ))}
            </ol>
          </section>
          <section className="border-border space-y-3 border-t pt-5">
            <h2 className="font-semibold">Faça parte</h2>
            <p className="text-muted-foreground text-sm">
              {item.admission === "direct"
                ? "O ingresso é verificado pelo servidor."
                : "A administração analisa cada solicitação de entrada."}{" "}
              Depois de entrar, conclua as boas-vindas e as regras obrigatórias da comunidade.
            </p>
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            {item.my_membership ? (
              <Button onClick={onEnter}>Abrir comunidade</Button>
            ) : !item.can_join ? (
              <p className="text-muted-foreground text-sm">
                Ingresso indisponível para esta conta.
              </p>
            ) : item.my_request?.status === "pending" ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-primary text-sm" role="status">
                  Solicitação pendente
                </p>
                <Button disabled={busy} variant="outline" onClick={onWithdraw}>
                  Retirar solicitação
                </Button>
              </div>
            ) : (
              <Button disabled={busy} onClick={onJoin}>
                {busy
                  ? "Verificando…"
                  : item.admission === "direct"
                    ? "Participar da comunidade"
                    : "Solicitar entrada"}
              </Button>
            )}
          </section>
        </div>
      </article>
    </section>
  );
}
