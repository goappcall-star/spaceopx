import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ReportQueueView,
  WarningsView,
  ModerationHistoryView,
  MemberActionForm,
  SecuritySettingsForm,
  ModeratorGrantForm,
  PlatformReviewForm,
  ReportForm,
} from "@/components/community/ModerationViews";
import type {
  CommunityReport,
  CommunityWarning,
  ModerationHistory,
  SecuritySettings,
  PlatformDirectoryReview,
} from "@/types/community-moderation";
const sid = "cc000000-0000-0000-0000-000000000010",
  actor = "cc000000-0000-0000-0000-000000000011",
  target = "cc000000-0000-0000-0000-000000000012",
  stamp = "2026-10-21T16:00:00Z";
const base: CommunityReport = {
  id: "cc000000-0000-0000-0000-000000000013",
  server_id: sid,
  kind: "message",
  target_id: target,
  category: "spam",
  status: "pending",
  revision: 1,
  description: "Exemplo fictício para avaliar a fila local.",
  evidence: "Trecho de mensagem sintética. Não é conteúdo de um usuário real.",
  evidence_until: "2026-11-20T16:00:00Z",
  reviewed_by: null,
  created_at: stamp,
  decisions: [],
};
export function ModerationPreview({ embedded = false }: { embedded?: boolean } = {}) {
  const [tab, setTab] = useState("Denúncias"),
    [reports, setReports] = useState([base]),
    [warnings, setWarnings] = useState<CommunityWarning[]>([]),
    [history, setHistory] = useState<ModerationHistory[]>([]),
    [security, setSecurity] = useState<SecuritySettings>({
      revision: 0,
      enabled: false,
      burst_limit: 8,
      repeat_limit: 3,
      mentions_limit: 8,
      blocked_domains: [],
    }),
    [directory, setDirectory] = useState<PlatformDirectoryReview>({
      server_id: sid,
      revision: 1,
      status: "listed",
      featured: true,
      presentation: {
        name: "Comunidade fictícia · exemplo local",
        description:
          "Uma apresentação pública sintética. Nenhum conteúdo privado é consultado nesta prévia.",
      },
    }),
    [notice, setNotice] = useState(""),
    [empty, setEmpty] = useState(false);
  const people = [
    { id: actor, name: "Moderador fictício" },
    { id: target, name: "Membro fictício" },
  ];
  function record(action: string, reason: string) {
    setHistory((old) => [
      {
        id: crypto.randomUUID(),
        entity_id: target,
        action,
        reason,
        actor_id: actor,
        created_at: new Date().toISOString(),
      },
      ...old,
    ]);
    setNotice("Operação realizada apenas em memória nesta prévia.");
  }
  return (
    <div className={"bg-background text-foreground " + (embedded ? "" : "min-h-screen")}>
      {!embedded && (
        <div className="border-border text-muted-foreground border-b p-3 text-xs">
          PRÉVIA LOCAL · componentes reais · dados fictícios · callbacks em memória · sem Supabase,
          autenticação ou permissões reais
        </div>
      )}
      <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-7">
        <header className="flex items-center gap-3">
          <img src="/lobbyx-logo.png" alt="LobbyX" className="h-10 w-10" />
          <div>
            <p className="text-primary text-xs">Comunidades LobbyX</p>
            <h1 className="text-xl font-bold">
              {tab === "Plataforma"
                ? "Central de Segurança da Plataforma"
                : "Moderação da Comunidade"}
            </h1>
          </div>
        </header>
        <nav className="flex flex-wrap gap-2">
          {[
            "Denúncias",
            "Advertências",
            "Histórico",
            "Segurança",
            "Plataforma",
            "Enviar denúncia",
          ].map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setEmpty(!empty)}>
            Alternar vazio
          </Button>
        </nav>
        {notice && (
          <p role="status" className="border-primary/30 text-primary rounded-xl border p-3 text-sm">
            {notice}
          </p>
        )}
        {tab === "Denúncias" && (
          <ReportQueueView
            items={empty ? [] : reports}
            busy={false}
            canReview
            onReview={(r, status, reason) => {
              setReports((rows) =>
                rows.map((x) =>
                  x.id === r.id
                    ? {
                        ...x,
                        status,
                        revision: x.revision + 1,
                        reviewed_by: actor,
                        decisions: [
                          ...x.decisions,
                          {
                            action: "report_" + status,
                            reason,
                            actor_id: actor,
                            created_at: new Date().toISOString(),
                          },
                        ],
                      }
                    : x,
                ),
              );
              record("report_" + status, reason);
            }}
          />
        )}
        {tab === "Advertências" && (
          <>
            <MemberActionForm
              members={people}
              busy={false}
              canWarn
              canSanction
              onAction={(t, a, r) => {
                if (a === "warn")
                  setWarnings((old) => [
                    {
                      id: crypto.randomUUID(),
                      target_user_id: t,
                      actor_id: actor,
                      reason: r,
                      status: "active",
                      revision: 1,
                      created_at: new Date().toISOString(),
                      decisions: [],
                    },
                    ...old,
                  ]);
                record(a, r);
              }}
            />
            <WarningsView
              items={empty ? [] : warnings}
              members={people}
              busy={false}
              canReview
              onRevoke={(w, r) => {
                setWarnings((rows) =>
                  rows.map((x) =>
                    x.id === w.id
                      ? {
                          ...x,
                          status: "revoked",
                          revision: x.revision + 1,
                          decisions: [
                            ...x.decisions,
                            {
                              action: "warning_revoked",
                              reason: r,
                              actor_id: sid,
                              created_at: new Date().toISOString(),
                            },
                          ],
                        }
                      : x,
                  ),
                );
                record("warning_revoked", r);
              }}
            />
          </>
        )}
        {tab === "Histórico" && <ModerationHistoryView items={empty ? [] : history} />}
        {tab === "Segurança" && (
          <>
            <SecuritySettingsForm
              key={security.revision}
              initial={security}
              busy={false}
              onSave={(s) => {
                setSecurity({ ...s, revision: s.revision + 1 });
                record("security_updated", "Configuração fictícia salva em memória.");
              }}
            />
            <ModeratorGrantForm
              roles={[{ id: actor, name: "Moderadores · cargo fictício" }]}
              busy={false}
              onGrant={(_r, c) =>
                record("delegation_updated", c.join(", ") || "Delegação removida")
              }
            />
          </>
        )}
        {tab === "Plataforma" && (
          <>
            <p className="text-muted-foreground text-sm">
              Demonstração de interface. Este seletor não concede acesso oficial à aplicação.
            </p>
            <ReportQueueView
              items={
                empty
                  ? []
                  : [
                      {
                        ...base,
                        kind: "directory",
                        target_id: sid,
                        description: "Denúncia pública fictícia.",
                        evidence: "Apresentação pública sintética.",
                      },
                    ]
              }
              busy={false}
              canReview
              onReview={(_r, s, why) => record("platform_report_" + s, why)}
            />
            <PlatformReviewForm
              key={directory.revision}
              data={directory}
              busy={false}
              onAction={(a, r) => {
                setDirectory({
                  ...directory,
                  status:
                    a === "suspend" ? "suspended" : a === "restore" ? "unlisted" : directory.status,
                  featured: false,
                  revision: directory.revision + 1,
                });
                record("directory_" + a, r);
              }}
            />
          </>
        )}
        {tab === "Enviar denúncia" && (
          <ReportForm
            kind="message"
            targetId={target}
            busy={false}
            onSubmit={(_c, d) => record("report_submitted", d || "Sem descrição adicional")}
          />
        )}
      </main>
    </div>
  );
}
