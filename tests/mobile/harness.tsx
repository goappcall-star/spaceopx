import { useState } from "react";
import { createRoot } from "react-dom/client";
import { AppSidebarDrawer } from "../../src/components/app/AppSidebarDrawer";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../src/components/ui/dialog";
import { ProfileCosmeticPicker } from "../../src/components/settings/ProfileCosmeticPicker";
import { ServerSettingsDialog } from "../../src/components/server-settings/ServerSettingsDialog";
import type { Server } from "../../src/types";
import { Button } from "../../src/components/ui/button";
import "../../src/styles.css";
export function App() {
  const [panel, setPanel] = useState("");
  const [dialog, setDialog] = useState(false);
  const [settings, setSettings] = useState(false);
  const [value, setValue] = useState("none");
  return (
    <div className="relative flex h-dvh min-h-0 overflow-hidden bg-background pt-12 text-foreground lg:pt-0">
      <header className="absolute inset-x-0 top-0 z-40 flex h-12 justify-between border-b bg-surface px-3 lg:hidden">
        <Button onClick={() => setPanel(panel === "left" ? "" : "left")}>Canais</Button>
        <Button onClick={() => setPanel(panel === "right" ? "" : "right")}>Membros</Button>
      </header>
      {panel && (
        <button
          aria-label="Fechar painel"
          className="absolute inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setPanel("")}
        />
      )}
      <AppSidebarDrawer side="left" open={panel === "left"}>
        <aside className="w-[76px] shrink-0 bg-surface p-3">LX</aside>
        <aside className="w-64 shrink-0 bg-surface p-3">
          <Button onClick={() => setPanel("")}>Abrir chat</Button>
        </aside>
      </AppSidebarDrawer>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
        <h1 className="mb-4 text-xl">Perfil e painéis do LobbyX</h1>
        <ProfileCosmeticPicker
          kind="frame"
          value={value}
          onChange={setValue}
          name="Usuário de teste"
          avatar=""
          banner=""
        />
        <Button className="mt-4" onClick={() => setDialog(true)}>
          Abrir card longo
        </Button>
        <Button className="mt-4" onClick={() => setSettings(true)}>
          Configurações do servidor
        </Button>
        <p className="mt-3" role="status">
          Escolha: {value}
        </p>
      </main>
      <AppSidebarDrawer side="right" open={panel === "right"}>
        <aside className="hidden w-64 shrink-0 flex-col bg-surface p-4 lg:flex">
          <h2>Membros</h2>
          <Button>Perfil do membro</Button>
        </aside>
      </AppSidebarDrawer>
      <ServerSettingsDialog
        open={settings}
        onOpenChange={setSettings}
        server={{ id: "fixture", name: "Servidor de teste", owner_id: "me" } as Server}
        members={[]}
        currentUserId="me"
      />
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogTitle>Card longo</DialogTitle>
          <DialogDescription>Teste de rolagem e botão de confirmação no celular.</DialogDescription>
          {Array.from({ length: 20 }, (_, i) => (
            <p key={i}>Informação do perfil {i + 1}</p>
          ))}
          <Button onClick={() => setDialog(false)}>Confirmar</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
