import { useState, type ReactNode } from "react";
import { CommunityHome } from "@/components/community/CommunityHome";
import { CommunityEventList } from "@/components/community/CommunityEventList";
import { CommunityEventEditor } from "@/components/community/CommunityEventEditor";
import { Button } from "@/components/ui/button";
import { DEFAULT_EXPERIENCE } from "@/lib/community-experience";
import type { Server, Channel } from "@/types";
import type { CommunityExperience } from "@/types/community-experience";
import type { CommunityEvent, EventMode } from "@/types/community-events";
import "../../src/styles.css";
const sid = "ca000000-0000-0000-0000-000000000001",
  cid = "ca000000-0000-0000-0000-000000000002",
  stamp = "2026-10-21T00:00:00Z";
const server: Server = {
  id: sid,
  owner_id: sid,
  name: "Squad de testes",
  description: "Um espaço local para avaliar os próximos encontros da comunidade.",
  icon_url: "/lobbyx-logo.png",
  banner_url: null,
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
    name: "sala-do-squad",
    type: "voice",
    category_id: null,
    description: null,
    position: 0,
    created_at: stamp,
    updated_at: stamp,
  },
];
const data: CommunityExperience = {
  server_id: sid,
  revision: 1,
  rules_revision: 1,
  can_manage: true,
  screened: false,
  experience: {
    ...DEFAULT_EXPERIENCE,
    modules: ["events", "channels", "voice", "interests", "notices"],
  },
  rules: [],
  interests: ["coop", "jogos"],
  progress: {
    completed_revision: 1,
    accepted_revision: 1,
    interests: [],
    selected_roles: [],
    updated_at: stamp,
  },
};
function EventsOnly({ events }: { events?: ReactNode }) {
  return <div className="p-4 sm:p-7">{events}</div>;
}
export function CommunityEventsPreview({ embedded = false }: { embedded?: boolean } = {}) {
  const Home = embedded ? EventsOnly : CommunityHome;
  const [items, setItems] = useState<CommunityEvent[]>([]),
    [editing, setEditing] = useState<{ event: CommunityEvent | null } | null>(null),
    [mode, setMode] = useState<EventMode>("upcoming"),
    [message, setMessage] = useState("");
  const list = items.filter((e) =>
    mode === "cancelled"
      ? e.status === "cancelled"
      : e.status === "scheduled" &&
        (mode === "past"
          ? Date.parse(e.starts_at) < Date.now()
          : Date.parse(e.starts_at) >= Date.now()),
  );
  return (
    <main className={"flex flex-col bg-background text-foreground " + (embedded ? "" : "h-dvh")}>
      {!embedded && (
        <p className="border-b border-border px-4 py-2 text-[11px] text-muted-foreground">
          PRÉVIA LOCAL · servidor e usuário fictícios · callbacks em memória, sem Supabase {message}
        </p>
      )}
      {embedded && message && (
        <p role="status" className="px-4 pt-4 text-sm text-primary">
          {message}
        </p>
      )}
      {embedded && (
        <div className="px-4 pt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const now = new Date();
              setItems([
                {
                  id: "ca000000-0000-0000-0000-000000000003",
                  server_id: sid,
                  title: "Encontro cooperativo · fixture",
                  description: "Exemplo fictício carregado somente em memória.",
                  cover_url: null,
                  channel_id: cid,
                  starts_at: new Date(now.getTime() + 86400000).toISOString(),
                  ends_at: null,
                  timezone: "America/Sao_Paulo",
                  status: "scheduled",
                  revision: 1,
                  created_at: now.toISOString(),
                  updated_at: now.toISOString(),
                  my_response: "none",
                  my_notify: false,
                  interested_count: 0,
                  going_count: 0,
                },
              ]);
              setMode("upcoming");
              setMessage("Exemplo fictício carregado. Não é um evento real.");
            }}
          >
            Carregar evento fictício
          </Button>
        </div>
      )}
      <Home
        server={server}
        data={data}
        channels={channels}
        participants={{}}
        onChannel={() => setMessage("Canal selecionado na prévia.")}
        onOnboarding={() => setMessage("Onboarding preservado; fora da prévia 3A.")}
        events={
          <CommunityEventList
            page={{ items: list, has_more: false, can_manage: true }}
            mode={mode}
            busy={false}
            loading={false}
            error={null}
            hasPrevious={false}
            channels={channels}
            onMode={setMode}
            onNext={() => {}}
            onBack={() => {}}
            onRefresh={() => {}}
            onNew={() => setEditing({ event: null })}
            onEdit={(event) => setEditing({ event })}
            onCancel={(event) => {
              setItems((v) =>
                v.map((x) =>
                  x.id === event.id ? { ...x, status: "cancelled", revision: x.revision + 1 } : x,
                ),
              );
              setMessage("Cancelamento somente na prévia.");
            }}
            onRespond={(event, response, notify) => {
              setItems((v) =>
                v.map((x) =>
                  x.id === event.id
                    ? {
                        ...x,
                        my_response: response,
                        my_notify: notify,
                        going_count: response === "going" ? 1 : 0,
                        interested_count: response === "interested" ? 1 : 0,
                      }
                    : x,
                ),
              );
              setMessage("Resposta do único usuário fictício salva na prévia.");
            }}
            onChannel={() => setMessage("Canal selecionado na prévia.")}
          />
        }
      />
      {editing && (
        <CommunityEventEditor
          initial={editing.event}
          channels={channels}
          conflict={false}
          onClose={() => setEditing(null)}
          onSave={async (id, payload, revision) => {
            const current = items.find((x) => x.id === id);
            const event: CommunityEvent = {
              ...payload,
              id,
              server_id: sid,
              status: "scheduled",
              revision: revision + 1,
              created_at: current?.created_at ?? new Date().toISOString(),
              updated_at: new Date().toISOString(),
              my_response: current?.my_response ?? "none",
              my_notify: current?.my_notify ?? false,
              interested_count: current?.interested_count ?? 0,
              going_count: current?.going_count ?? 0,
            };
            setItems((v) => [...v.filter((x) => x.id !== id), event]);
            setMessage("Evento salvo apenas em memória nesta prévia.");
          }}
        />
      )}
    </main>
  );
}
