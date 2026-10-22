import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { CommunityOnboarding } from "@/components/community/CommunityOnboarding";
import { CommunityActivationWizard } from "@/components/community/CommunityActivationWizard";
import { CommunityCustomizationForm } from "@/components/community/CommunityCustomizationForm";
import { DEFAULT_EXPERIENCE } from "@/lib/community-experience";
import type { CommunityExperience } from "@/types/community-experience";
import type { Server, Channel, Role } from "@/types";
import "./preview.css";

const Audio = lazy(() =>
  import("../audio-preview/preview").then((m) => ({ default: m.AudioPreview })),
);
const Evolution = lazy(() =>
  import("../community-evolution-preview/preview").then((m) => ({ default: m.Preview })),
);
const ServerAccess = lazy(() =>
  import("../server-access-preview/preview").then((m) => ({ default: m.ServerAccessPreview })),
);
const Events = lazy(() =>
  import("../community-events-preview/preview").then((m) => ({
    default: m.CommunityEventsPreview,
  })),
);
const Discovery = lazy(() =>
  import("../community-discovery-preview/preview").then((m) => ({ default: m.DiscoveryPreview })),
);
const Moderation = lazy(() =>
  import("../community-moderation-preview/preview").then((m) => ({ default: m.ModerationPreview })),
);
const pages = [
  "Home",
  "Eventos",
  "Explorar",
  "Moderação",
  "Evolução",
  "Estatísticas",
  "Personalização",
  "Configurações",
  "Servidores",
  "Áudio",
] as const;
type Page = (typeof pages)[number];
const sid = "c5000000-0000-0000-0000-000000000001",
  cid = "c5000000-0000-0000-0000-000000000002",
  rid = "c5000000-0000-0000-0000-000000000003";
const stamp = new Date().toISOString();
const server: Server = {
  id: sid,
  owner_id: sid,
  name: "Órbita · avaliação local",
  description:
    "Seu squad tem um lugar. Comunidade fictícia para avaliar a experiência completa do LobbyX.",
  icon_url: "/lobbyx-logo.png",
  banner_url: "/auth/lobbyx-city-v1.webp",
  visibility: "private",
  created_at: stamp,
  updated_at: stamp,
  interactions: {
    allow_messages: true,
    allow_reactions: true,
    allow_mentions: true,
    allow_member_invites: false,
    allow_member_dms: true,
  },
};
const channels: Channel[] = [
  {
    id: cid,
    server_id: sid,
    name: "boas-vindas",
    type: "text",
    category_id: null,
    description: "Comece por aqui",
    position: 0,
    created_at: stamp,
    updated_at: stamp,
  },
];
const roles: Role[] = [
  {
    id: rid,
    server_id: sid,
    name: "Explorador",
    color: "#a3e635",
    position: 1,
    permissions: {},
    created_at: stamp,
  },
];
const initial: CommunityExperience = {
  server_id: sid,
  revision: 1,
  rules_revision: 1,
  can_manage: true,
  screened: true,
  rules: [{ id: "respect", text: "Respeite as pessoas e não compartilhe dados pessoais." }],
  interests: ["coop", "tecnologia"],
  progress: null,
  experience: {
    ...DEFAULT_EXPERIENCE,
    intro: server.description!,
    welcome_enabled: true,
    welcome_text: "Bem-vindo à Órbita! Escolha como participar.",
    rules_enabled: true,
    rules_required: true,
    interests_enabled: true,
    channels_enabled: true,
    roles_enabled: true,
    role_ids: [rid],
    featured_channels: [cid],
    modules: ["notices", "channels", "interests", "events", "voice"],
    notices: [
      {
        id: "c5000000-0000-0000-0000-000000000004",
        title: "Bem-vindo ao seu espaço",
        body: "Esta é uma prévia local com dados fictícios. Nenhuma ação altera servidores reais.",
      },
    ],
  },
};

function Session() {
  const [page, setPage] = useState<Page>("Home"),
    [visited, setVisited] = useState<Page[]>(["Home"]),
    [enabled, setEnabled] = useState(true),
    [experience, setExperience] = useState(initial),
    [onboarding, setOnboarding] = useState(false),
    [wizard, setWizard] = useState(false),
    [edit, setEdit] = useState(false),
    [notice, setNotice] = useState("");
  function navigate(next: Page) {
    setPage(next);
    setVisited((v) => (v.includes(next) ? v : [...v, next]));
  }
  const evolutionPages: Page[] = ["Home", "Evolução", "Estatísticas", "Personalização"];
  const view =
    page === "Estatísticas"
      ? "statistics"
      : page === "Personalização"
        ? "cosmetics"
        : page === "Evolução"
          ? "evolution"
          : "home";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/lobbyx-logo.png" alt="LobbyX" className="h-8 w-8" />
            <div>
              <h1 className="font-semibold">Comunidades V1</h1>
              <p className="text-xs text-muted-foreground">Avaliação local · Fases 1–4C</p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            Cenário de servidor
            <select
              aria-label="Cenário de servidor"
              className="rounded-lg border border-border bg-background p-2"
              value={enabled ? "community" : "ordinary"}
              onChange={(e) => {
                setEnabled(e.target.value === "community");
                setWizard(false);
                setEdit(false);
                setOnboarding(false);
                setNotice("");
              }}
            >
              <option value="community">Comunidade ativada</option>
              <option value="ordinary">Servidor comum</option>
            </select>
          </label>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1600px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-border p-4 lg:min-h-[calc(100vh-150px)] lg:w-56 lg:border-r lg:border-b-0">
          <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">
            Central da Comunidade
          </p>
          <nav aria-label="Módulos da comunidade" className="flex flex-wrap gap-2 lg:flex-col">
            {pages.map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="sm"
                className="justify-start"
                aria-current={p === page ? "page" : undefined}
                onClick={() => navigate(p)}
              >
                {p}
              </Button>
            ))}
          </nav>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Somente a área de comunidade é representada. Central Social e hotbar reais não são
            montadas nem alteradas nesta prévia.
          </p>
        </aside>
        <main className="min-w-0 flex-1">
          {notice && (
            <p
              role="status"
              className="m-4 rounded-xl border border-primary/30 p-3 text-sm text-primary"
            >
              {notice}
            </p>
          )}
          {!enabled &&
            page !== "Configurações" &&
            page !== "Explorar" &&
            page !== "Servidores" &&
            page !== "Áudio" && (
              <section className="space-y-4 p-6">
                <h2 className="text-2xl font-semibold">Servidor comum</h2>
                <p className="text-sm text-muted-foreground">
                  Os módulos exclusivos de comunidade estão ocultos. Canais e recursos normais
                  permanecem no aplicativo.
                </p>
                <Button onClick={() => navigate("Configurações")}>Avaliar ativação</Button>
              </section>
            )}
          <div
            hidden={
              !enabled &&
              page !== "Configurações" &&
              page !== "Explorar" &&
              page !== "Servidores" &&
              page !== "Áudio"
            }
          >
            <Suspense
              fallback={
                <p role="status" className="p-6">
                  Carregando módulo…
                </p>
              }
            >
              <div hidden={!enabled || !evolutionPages.includes(page)}>
                <Evolution
                  embedded
                  view={view}
                  home={{
                    server,
                    data: experience,
                    channels,
                    participants: {},
                    onChannel: () =>
                      setNotice(
                        "Canal selecionado apenas na prévia. Mensagens e voz reais não são montadas.",
                      ),
                    onOnboarding: () => setOnboarding(true),
                    onSettings: () => navigate("Configurações"),
                    evolutionTools: (
                      <Button variant="outline" size="sm" onClick={() => navigate("Estatísticas")}>
                        Ver estatísticas
                      </Button>
                    ),
                    events: (
                      <Button variant="outline" onClick={() => navigate("Eventos")}>
                        Abrir agenda da comunidade
                      </Button>
                    ),
                  }}
                />
              </div>
              {visited.includes("Eventos") && (
                <div hidden={page !== "Eventos"}>
                  <Events embedded />
                </div>
              )}
              {page === "Áudio" && <Audio />}
              {visited.includes("Servidores") && (
                <div hidden={page !== "Servidores" && page !== "Áudio"}>
                  <ServerAccess />
                </div>
              )}
              {visited.includes("Explorar") && (
                <div hidden={page !== "Explorar"}>
                  <Discovery embedded />
                </div>
              )}
              {visited.includes("Moderação") && (
                <div hidden={page !== "Moderação"}>
                  <Moderation embedded />
                </div>
              )}
              {page === "Configurações" && (
                <section className="space-y-5 p-4 md:p-8">
                  <h2 className="text-2xl font-semibold">Configurações da comunidade</h2>
                  <p className="text-sm text-muted-foreground">
                    Fixture de proprietário. As permissões reais são verificadas no backend; esta
                    prévia não as autentica.
                  </p>
                  {wizard ? (
                    <CommunityActivationWizard
                      server={server}
                      channels={channels}
                      initial={null}
                      busy={false}
                      canSubmit
                      onCancel={() => setWizard(false)}
                      onEditProfile={() => setNotice("Identidade oficial preservada na fixture.")}
                      onSubmit={(p) => {
                        setExperience({
                          ...experience,
                          rules: p.rules,
                          interests: p.interests,
                          revision: experience.revision + 1,
                        });
                        setEnabled(true);
                        setWizard(false);
                        setNotice("Comunidade ativada somente na memória da prévia.");
                      }}
                    />
                  ) : edit ? (
                    <CommunityCustomizationForm
                      initial={experience}
                      channels={channels}
                      roles={roles}
                      conflict={false}
                      onCancel={() => setEdit(false)}
                      onSave={async (cfg) => {
                        setExperience({
                          ...experience,
                          experience: cfg,
                          revision: experience.revision + 1,
                        });
                        setEdit(false);
                        setNotice("Personalização e boas-vindas salvas somente nesta prévia.");
                      }}
                    />
                  ) : (
                    <>
                      <div className="rounded-2xl border border-border bg-surface p-5">
                        <h3 className="font-semibold">
                          {enabled ? "Comunidade ativada" : "Servidor comum"}
                        </h3>
                        <p className="my-3 text-sm text-muted-foreground">
                          Ativar ou desativar preserva a identidade e os dados desta fixture.
                          Nenhuma migration é executada.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => (enabled ? setEdit(true) : setWizard(true))}>
                            {enabled ? "Editar Home e boas-vindas" : "Abrir assistente de ativação"}
                          </Button>
                          {enabled && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEnabled(false);
                                setNotice(
                                  "Comunidade desativada na prévia. Configuração preservada para reativação.",
                                );
                              }}
                            >
                              Desativar na prévia
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload autenticado não é simulado: o banner desta fixture é um ativo local.
                        Ganhos de XP e verificador continuam desligados.
                      </p>
                    </>
                  )}
                </section>
              )}
            </Suspense>
          </div>
        </main>
      </div>
      {enabled && onboarding && (
        <CommunityOnboarding
          data={experience}
          channels={channels}
          roles={roles}
          onClose={() => setOnboarding(false)}
          onSave={async (input) => {
            setExperience((old) => ({
              ...old,
              progress: {
                accepted_revision: input.accept ? old.rules_revision : null,
                interests: input.interests,
                selected_roles: input.roles,
                completed_revision: input.complete ? old.revision : null,
                updated_at: new Date().toISOString(),
              },
            }));
            setNotice("Boas-vindas salvas na fixture. Nenhum cargo real foi atribuído.");
          }}
        />
      )}
    </div>
  );
}
export function UnifiedPreview() {
  const [account, setAccount] = useState("A"),
    [revision, setRevision] = useState(0);
  return (
    <>
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-primary/30 bg-background p-3">
        <div>
          <p className="text-xs font-semibold text-primary">
            PRÉVIA LOCAL · DADOS FICTÍCIOS · SEM SUPABASE
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Callbacks em memória, fixtures independentes por módulo. Não valida login, voz ou
            permissões reais.
          </p>
        </div>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="preview-account">
            Conta fictícia
          </label>
          <select
            id="preview-account"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            className="max-w-40 rounded-lg border border-border bg-background p-2 text-xs"
          >
            <option value="A">Conta fictícia A</option>
            <option value="B">Conta fictícia B</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => setRevision((r) => r + 1)}>
            Reiniciar prévia
          </Button>
        </div>
      </header>
      <Session key={`${account}:${revision}`} />
    </>
  );
}
