import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  SidebarBlankMenu,
  SidebarCategoryMenu,
  SidebarChannelMenu,
} from "../../src/components/app/SidebarContextMenus";
import { DEFAULT_SERVER_PREFERENCES } from "../../src/hooks/use-server-preferences";
import type { Channel } from "../../src/types";
import "../../src/styles.css";
const category = {
  id: "fixture-category",
  server_id: "fixture-server",
  name: "JOGOS",
  position: 0,
  created_at: "2026-10-05",
};
const channel = {
  id: "fixture-channel",
  server_id: "fixture-server",
  category_id: category.id,
  name: "Valorant",
  type: "text",
  description: null,
  position: 0,
  created_at: "2026-10-05",
  updated_at: "2026-10-05",
} as Channel;
function Harness() {
  const [preferences, setPreferences] = useState(DEFAULT_SERVER_PREFERENCES),
    [collapsed, setCollapsed] = useState(false),
    [action, setAction] = useState("Pronto"),
    [manager, setManager] = useState(true);
  const update = (patch: Partial<typeof preferences>) =>
    setPreferences((p) => ({ ...p, ...patch }));
  const choose = (label: string) => () => setAction(label);
  return (
    <main className="bg-background text-foreground min-h-screen p-8">
      <h1>Teste de menus — sem banco de dados</h1>
      <label>
        <input type="checkbox" checked={manager} onChange={(e) => setManager(e.target.checked)} />{" "}
        Permissão de administrador
      </label>
      <SidebarBlankMenu
        preferences={preferences}
        update={update}
        canManage={manager}
        canInvite
        createChannel={choose("Criar canal")}
        createCategory={choose("Criar categoria")}
        invite={choose("Convidar")}
      >
        <aside data-testid="blank-menu" className="bg-surface mt-6 h-96 w-64 rounded-lg p-3">
          <SidebarCategoryMenu
            category={category}
            preferences={preferences}
            update={update}
            collapsed={collapsed}
            toggle={() => setCollapsed((v) => !v)}
            collapseAll={() => setCollapsed(true)}
            markRead={choose("Marcar categoria lida")}
            hasUnread
            canManage={manager}
            edit={choose("Editar categoria")}
            remove={choose("Excluir categoria")}
            move={(where) => setAction("Mover categoria: " + where)}
            createChannel={choose("Criar canal na categoria")}
            copy={choose("Copiar ID da categoria")}
          >
            <button className="w-full p-2 text-left">JOGOS</button>
          </SidebarCategoryMenu>
          {!collapsed && (
            <SidebarChannelMenu
              channel={channel}
              categories={[category]}
              preferences={preferences}
              update={update}
              canManage={manager}
              markRead={choose("Marcar canal lido")}
              hasUnread
              toggleMute={() =>
                update({ mutedChannels: preferences.mutedChannels.length ? [] : [channel.id] })
              }
              edit={choose("Editar canal")}
              remove={choose("Excluir canal")}
              assign={(id) => setAction("Mover canal: " + id)}
              invite={choose("Convidar")}
              copy={choose("Copiar ID do canal")}
            >
              <button className="w-full p-2 text-left"># Valorant</button>
            </SidebarChannelMenu>
          )}
        </aside>
      </SidebarBlankMenu>
      <p role="status">{action}</p>
      <pre>{JSON.stringify(preferences, null, 2)}</pre>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Harness />);
