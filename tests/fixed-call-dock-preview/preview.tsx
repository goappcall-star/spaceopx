import { createRoot } from "react-dom/client";
import { SessionCallDock, IdleSessionProfile } from "@/components/call/SessionCallDock";
import { ScreenViewingProvider } from "@/components/call/ScreenViewingProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreviewProviders, usePreview, scenarios } from "./fixtures";
import { SettingsShell } from "@/components/settings/SettingsShell";
import { ProfilePreview } from "../profile-settings-preview/preview";
import { MessageComposer } from "@/components/chat/MessageComposer";
import "@/components/app/app-navigation-layout.css";
import "@/styles.css";
document.documentElement.classList.add("dark");
document.documentElement.dataset.accent = "neon_green";
function Preview() {
  const c = usePreview();
  return (
    <ScreenViewingProvider key={c.account}>
      <TooltipProvider>
        <div className="session-communications-layout">
          <div className="session-route-content">
            {c.page === "Configurações" ? (
              <SettingsShell active="profile">
                <ProfilePreview onBack={() => c.setPage("Mensagens")} />
              </SettingsShell>
            ) : (
              <main className="flex h-full min-h-0 bg-background text-foreground">
                <aside
                  style={{
                    width: 332,
                    flexShrink: 0,
                    flexDirection: "column",
                    background: "var(--surface)",
                  }}
                  className="p-4 hidden md:flex md:flex-col"
                >
                  <h2 className="font-semibold">LobbyX · prévia local</h2>
                  <p className="my-4 text-xs text-primary">DADOS FICTÍCIOS · SEM WEBRTC</p>
                  {["Servidor LobbyX", "Outro servidor", "Mensagens", "Configurações"].map(
                    (page) => (
                      <button
                        key={page}
                        className="block w-full p-3 rounded-lg text-left hover:bg-surface-hover"
                        onClick={() => c.setPage(page)}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <div className="app-navigation-profile mt-auto">
                    <IdleSessionProfile />
                  </div>
                </aside>
                <div className="flex min-w-0 flex-1 flex-col p-4">
                  <header>
                    <p className="text-xs text-primary mb-3">
                      ESTADOS SIMULADOS · NENHUMA CAPTURA OU SESSÃO REAL
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {scenarios.map((s) => (
                        <button
                          key={s}
                          className="rounded-lg border border-border bg-surface px-3 py-2 text-xs"
                          onClick={() => c.setScenario(s)}
                        >
                          {s}
                        </button>
                      ))}
                      <button
                        className="rounded-lg border p-2 text-xs"
                        onClick={() => {
                          c.setScenario("Fora de chamada");
                          c.setAccount(c.account === "fixture" ? "second" : "fixture");
                        }}
                      >
                        Simular troca de conta
                      </button>
                    </div>
                  </header>
                  <section className="flex-1 min-h-0 overflow-auto py-8">
                    <h1 className="text-2xl font-semibold">{c.page}</h1>
                    <p className="my-3 text-muted-foreground">
                      A hotbar abaixo usa os componentes reais. Navegar preserva a chamada simulada.
                    </p>
                    {c.events.map((event, index) => (
                      <p key={index} className="my-2 text-sm text-primary" role="status">
                        {event}
                      </p>
                    ))}
                  </section>
                  <MessageComposer
                    serverId="fixture"
                    channelId="fixture"
                    channelName="✨Bem-Vindo✨"
                    members={[]}
                    disabled={false}
                    replyTo={null}
                    onCancelReply={() => {}}
                    onTyping={() => {}}
                    onSend={async () => {
                      c.setEvents((e) => [...e, "Mensagem apenas na prévia; nenhum envio real."]);
                    }}
                  />
                </div>
              </main>
            )}
          </div>
          <SessionCallDock />
        </div>
      </TooltipProvider>
    </ScreenViewingProvider>
  );
}
createRoot(document.getElementById("root")!).render(
  <PreviewProviders>
    <Preview />
  </PreviewProviders>,
);
