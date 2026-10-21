import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CommunityHome } from "@/components/community/CommunityHome";
import {
  CommunityProgressionView,
  CommunityXpHistoryView,
} from "@/components/community/CommunityProgressionView";
import { Button } from "@/components/ui/button";
import type { CommunityExperience } from "@/types/community-experience";
import type { Server } from "@/types";
import type { CommunityProgression, CommunityXpEntry } from "@/types/community-progression";
import "../../src/styles.css";
const id = "d4000000-0000-0000-0000-000000000001";
const server = {
  id,
  name: "Órbita · comunidade de demonstração",
  description: "Converse, jogue e construa uma comunidade com seu squad.",
  icon_url: "/lobbyx-logo.png",
  banner_url: null,
  visibility: "private",
} as Server;
const experience: CommunityExperience = {
  server_id: id,
  revision: 1,
  rules_revision: 1,
  can_manage: true,
  screened: false,
  rules: [],
  interests: ["Cooperativo", "Jogos", "Tecnologia"],
  progress: null,
  experience: {
    home_enabled: true,
    intro: server.description ?? "",
    banner_url: null,
    notices: [
      {
        id: "notice",
        title: "Uma evolução construída em conjunto",
        body: "Nesta prévia, o progresso e o histórico são fictícios e permanecem apenas na memória.",
      },
    ],
    featured_channels: [],
    modules: ["notices", "interests"],
    welcome_enabled: false,
    welcome_text: "",
    rules_enabled: false,
    rules_required: false,
    interests_enabled: true,
    channels_enabled: false,
    roles_enabled: false,
    role_ids: [],
  },
};
const populated: CommunityProgression = {
  server_id: id,
  xp: 1350,
  level: 2,
  level_floor: 1000,
  next_level_xp: 2500,
  curve_version: 1,
  earning_enabled: false,
  daily_cap: 500,
  weekly_cap: 2000,
};
let fixtureTotal = 1350;
const entries: CommunityXpEntry[] = Array.from({ length: 22 }, (_, n) => {
  const awarded = n === 1 ? 0 : n === 0 ? 100 : 50;
  const total = fixtureTotal;
  fixtureTotal -= awarded;
  return {
    id: String(22 - n),
    awarded_xp: awarded,
    requested_xp: 100,
    outcome: n === 1 ? "capped" : "granted",
    total_after: total,
    policy_revision: 1,
    created_at: new Date(Date.UTC(2026, 9, 21, 16, 30 - n)).toISOString(),
  };
});
export function Preview() {
  const [empty, setEmpty] = useState(false),
    [history, setHistory] = useState(false),
    [page, setPage] = useState(0),
    [member, setMember] = useState(false),
    [message, setMessage] = useState("");
  const data = empty
    ? { ...populated, xp: 0, level: 1, level_floor: 0, next_level_xp: 1000 }
    : populated;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-primary/30 bg-background px-5 py-3">
        <p className="text-xs text-primary">
          PRÉVIA LOCAL 4A · DADOS FICTÍCIOS · SEM CONEXÃO COM SUPABASE
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEmpty(!empty);
              setPage(0);
            }}
          >
            {empty ? "Ver exemplo com XP" : "Comunidade sem XP"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMember(!member);
              setHistory(false);
            }}
          >
            {member ? "Visão de gestor" : "Visão de membro"}
          </Button>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-64 shrink-0 border-r border-border p-5 lg:block">
          <img className="mb-6 h-9 w-9" src="/lobbyx-logo.png" alt="LobbyX" />
          <p className="font-semibold">Órbita</p>
          <p className="mt-2 text-xs text-muted-foreground">Comunidade de demonstração</p>
          <div className="mt-6 rounded-lg bg-primary/10 p-3 text-sm text-primary">
            Página inicial
          </div>
          <p className="mt-5 px-3 text-xs text-muted-foreground">Navegação existente preservada</p>
        </aside>
        <main className="min-w-0 flex-1">
          {history && !member ? (
            <div className="space-y-5 p-5 md:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-primary">EVOLUÇÃO COLETIVA</p>
                  <h1 className="text-2xl font-bold">Histórico de XP</h1>
                </div>
                <Button variant="outline" onClick={() => setHistory(false)}>
                  Voltar à Home
                </Button>
              </div>
              <CommunityXpHistoryView
                entries={empty ? [] : entries.slice(page * 20, (page + 1) * 20)}
                busy={false}
                canNext={!empty && page === 0}
                onBack={() => setPage(0)}
                onNext={() => setPage(1)}
              />
            </div>
          ) : (
            <CommunityHome
              server={server}
              data={{ ...experience, can_manage: !member }}
              channels={[]}
              participants={{}}
              onChannel={() => {}}
              onOnboarding={() =>
                setMessage("As boas-vindas pertencem à Fase 2; esta prévia não salva dados.")
              }
              onSettings={
                member
                  ? undefined
                  : () =>
                      setMessage(
                        "A curva e as concessões são configuradas exclusivamente no backend.",
                      )
              }
              progression={
                <CommunityProgressionView
                  data={data}
                  onHistory={
                    member
                      ? undefined
                      : () => {
                          setPage(0);
                          setHistory(true);
                        }
                  }
                />
              }
            />
          )}
          {message && (
            <p role="status" className="px-8 pb-6 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
const root = createRoot(document.getElementById("root")!);
root.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
