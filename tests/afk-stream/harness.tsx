import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateChannelDialog } from "../../src/components/app/CreateChannelDialog";
import { WatchStreamButton } from "../../src/components/gamer/WatchStreamButton";
import { VoiceFixtureContext, testState } from "./fixture";
import "../../src/styles.css";
const query = new QueryClient();
function Harness() {
  const [open, setOpen] = useState(false),
    [sharing, setSharing] = useState(true),
    [member, setMember] = useState(true),
    [result, setResult] = useState("");
  const voice = {
    participantsByChannel: { voice: [{ user_id: "peer", screen: sharing }] },
    activeChannelId: null,
    activeServerId: null,
    setVideoHidden: () => {},
    join: async (id: string, server: string, listen: boolean) => {
      testState.watched = JSON.stringify({ id, server, listen });
    },
  };
  return (
    <QueryClientProvider client={query}>
      <VoiceFixtureContext.Provider value={voice}>
        <main className="bg-background text-foreground min-h-dvh p-6">
          <h1 className="text-xl font-bold">LobbyX · Teste local</h1>
          <button className="mt-6 rounded-lg border p-3" onClick={() => setOpen(true)}>
            Criar canal
          </button>
          <CreateChannelDialog
            serverId="server"
            open={open}
            onOpenChange={setOpen}
            onCreated={() => setResult(testState.created)}
          />
          <section className="bg-surface mt-6 max-w-sm rounded-xl border p-5">
            <h2 className="font-semibold">Perfil de Amigo</h2>
            <p className="text-muted-foreground text-sm">@amigo · Online</p>
            <WatchStreamButton
              userId="peer"
              sharedServers={member ? [{ id: "server" }] : []}
              onDone={() => setResult(testState.watched)}
            />
          </section>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setSharing(!sharing)}>
              {sharing ? "Parar transmissão" : "Iniciar transmissão"}
            </button>
            <button onClick={() => setMember(!member)}>
              {member ? "Sair do servidor" : "Voltar ao servidor"}
            </button>
          </div>
          <output className="mt-6 block break-all">{result}</output>
        </main>
      </VoiceFixtureContext.Provider>
    </QueryClientProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
