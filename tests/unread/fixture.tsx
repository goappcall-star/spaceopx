import { createRoot } from "react-dom/client";
import { ServerRail } from "../../src/components/app/ServerRail";
import { UnreadBadge } from "../../src/components/app/UnreadBadge";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import type { Server } from "../../src/types";
import { DEFAULT_SERVER_PREFERENCES } from "../../src/hooks/use-server-preferences";
import "../../src/styles.css";
const servers = [
  { id: "one", name: "Jogatina", icon_url: null },
  { id: "two", name: "Comunidade", icon_url: null },
] as Server[];
createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <main className="bg-background text-foreground flex min-h-screen">
      <ServerRail
        servers={servers}
        activeServerId={null}
        onSelect={() => {}}
        onHome={() => {}}
        onAdd={() => {}}
        socialActive={false}
        onSelectSocial={() => {}}
        serverBadges={{ one: 8, two: 123 }}
        serverMentions={{ one: 2 }}
        socialBadge={4}
        getPreferences={() => DEFAULT_SERVER_PREFERENCES}
        onUpdatePreferences={() => {}}
        onServerAction={() => {}}
      />
      <section className="p-8">
        <h1 className="text-xl font-semibold">Mensagens não lidas</h1>
        <p className="text-muted-foreground mt-2">
          Prévia sem acesso ao banco — contagem persistente, sem animações.
        </p>
        <div className="bg-surface mt-6 flex w-72 items-center gap-3 rounded-xl p-4">
          <span className="bg-primary/15 flex h-10 w-10 items-center justify-center rounded-full">
            NM
          </span>
          <span className="flex-1">Conversa privada</span>
          <UnreadBadge count={8} />
        </div>
        <div className="bg-surface mt-3 flex w-72 items-center gap-3 rounded-xl p-4">
          <span className="flex-1"># bate-papo</span>
          <UnreadBadge count={3} title="3 mensagens não lidas; 1 menção" />
        </div>
      </section>
    </main>
  </TooltipProvider>,
);
