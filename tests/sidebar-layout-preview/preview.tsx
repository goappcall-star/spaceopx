import { AppNavigationLayout } from "@/components/app/AppNavigationLayout";
import { useState } from "react";
import { ServerRail } from "@/components/app/ServerRail";
import { UserBar } from "@/components/app/UserBar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_SERVER_PREFERENCES } from "@/hooks/use-server-preferences";
import { PreviewProviders } from "./fixtures";
import type { Server } from "@/types";
function server(index: number): Server {
  return {
    id: String(index),
    name: ["LobbyX", "Squad", "Estudos"][index] ?? `Servidor ${index + 1}`,
    owner_id: "fixture",
    description: null,
    icon_url: index === 0 ? "/lobbyx-logo.png" : null,
    banner_url: null,
    visibility: "private",
    created_at: "2026-10-22T00:00:00Z",
    updated_at: "2026-10-22T00:00:00Z",
    interactions: {
      allow_messages: true,
      allow_reactions: true,
      allow_mentions: true,
      allow_member_invites: false,
      allow_member_dms: true,
    },
  };
}
export function Preview() {
  const [count, setCount] = useState(3),
    [selected, setSelected] = useState<string | null>("0"),
    [social, setSocial] = useState(false),
    [notice, setNotice] = useState("");
  return (
    <TooltipProvider>
      <PreviewProviders>
        <header className="h-[100px] border-b border-border p-3">
          <p className="text-xs font-semibold text-primary">
            PRÉVIA LOCAL · DADOS FICTÍCIOS · SEM LOGIN OU ÁUDIO REAL
          </p>
          <div className="mt-3 flex gap-3 text-xs">
            <button onClick={() => setCount(3)}>Poucos servidores</button>
            <button onClick={() => setCount(30)}>Muitos servidores</button>
            <button onClick={() => setCount(0)}>Sem servidores</button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {notice || "Componentes reais, serviços substituídos somente nesta prévia."}
          </p>
        </header>
        <div className="sidebar-preview-window">
          <AppNavigationLayout profile={<UserBar expanded />}>
            <ServerRail
              servers={Array.from({ length: count }, (_, index) => server(index))}
              activeServerId={selected}
              onSelect={setSelected}
              onHome={() => setSelected(null)}
              onAdd={() =>
                setNotice(
                  "Criar/entrar: o callback existente foi acionado. O modal real permanece no aplicativo.",
                )
              }
              socialActive={social}
              onSelectSocial={() => setSocial((value) => !value)}
              socialBadge={3}
              serverBadges={{ "1": 8 }}
              getPreferences={() => DEFAULT_SERVER_PREFERENCES}
              onUpdatePreferences={() => {}}
              onServerAction={() => {}}
            />
            <aside className="bg-surface border-border relative z-20 flex w-64 shrink-0 flex-col border-r">
              <div className="border-b border-border p-4 text-sm font-semibold">
                {social ? "Social" : "LobbyX"}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 text-sm text-muted-foreground">
                <p className="mb-4">{social ? "Amigos e conversas" : "CANAIS DE TEXTO"}</p>
                <p># geral</p>
                <p className="mt-4"># novidades</p>
              </div>
            </aside>
          </AppNavigationLayout>
          <main className="min-w-0 flex-1 bg-background p-6">
            <h1 className="text-xl font-semibold">Barra lateral e perfil</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Teste a rolagem e os menus de dispositivos. Os controles desta prévia não capturam
              mídia.
            </p>
          </main>
        </div>
      </PreviewProviders>
    </TooltipProvider>
  );
}
