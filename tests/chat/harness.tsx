import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MessageItem } from "../../src/components/chat/MessageItem";
import { DmMessageItem } from "../../src/components/social/DmMessageItem";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { AppSidebarDrawer } from "../../src/components/app/AppSidebarDrawer";
import type { MessageWithMeta, DirectMessageWithMeta } from "../../src/types";
import "../../src/styles.css";
const author = { id: "peer", display_name: "Amigo", username: "amigo", avatar_url: null };
const base = {
  id: "message",
  author_id: "peer",
  sender_id: "peer",
  channel_id: "room",
  content: "Mensagem de teste para selecionar uma reacao sem piscar.",
  author,
  created_at: new Date().toISOString(),
  edited_at: null,
  deleted_at: null,
  attachments: [],
  reactions: [],
  reply_to: null,
};
function Harness() {
  const [selected, setSelected] = useState("");
  const [navigation, setNavigation] = useState(false);
  const props = {
    compact: false,
    isOwn: false,
    onReply: () => {},
    onEdit: async () => {},
    onDelete: async () => {},
    onReact: (_id: string, emoji: string) => setSelected(emoji),
  };
  return (
    <TooltipProvider>
      <div className="bg-background text-foreground relative flex h-dvh min-h-0 overflow-hidden pt-12 md:pt-0">
        <header className="absolute top-0 inset-x-0 h-12 flex items-center justify-between px-3 md:hidden">
          <button onClick={() => setNavigation(!navigation)}>Abrir canais</button>
          <span>LobbyX</span>
        </header>
        <AppSidebarDrawer open={navigation} side="left">
          <nav className="w-[76px] shrink-0 bg-surface">Servidores</nav>
          <aside className="w-64 shrink-0 bg-surface-elevated p-3">
            <h2>Canais</h2>
            <button onClick={() => setNavigation(false)}>bate-papo</button>
          </aside>
        </AppSidebarDrawer>
        <main className="min-w-0 flex-1 overflow-y-auto py-16">
          <div className="mx-auto max-w-3xl">
            <h1>Servidor</h1>
            <MessageItem
              {...props}
              message={base as unknown as MessageWithMeta}
              canDelete={false}
            />
            <h1 className="mt-16">Privado</h1>
            <DmMessageItem
              {...props}
              message={{ ...base, id: "dm" } as unknown as DirectMessageWithMeta}
              onOpenProfile={() => {}}
            />
            <output className="block mt-16">Reacao selecionada: {selected}</output>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
