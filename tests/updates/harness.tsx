import { createRoot } from "react-dom/client";
import { DesktopUpdates } from "../../src/components/app/DesktopUpdates";
import { reportDesktopCall, clearDesktopCall } from "../../src/services/desktop-updates";
import type { DesktopUpdateState } from "../../src/services/desktop-updates";
import "../../src/styles.css";
let state: DesktopUpdateState = {
  status: "idle",
  version: "0.1.25",
  currentVersion: "0.1.24",
  percent: 0,
  busy: false,
  message: null,
};
const listeners = new Set<(state: DesktopUpdateState) => void>();
function emit(patch: Partial<DesktopUpdateState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener(state));
  return state;
}
window.lobbyxDesktop = {
  activity: async () => ({
    enabled: false,
    leagueMode: "auto",
    microphone: null,
    camera: null,
    game: null,
  }),
  preference: async () => ({
    enabled: false,
    leagueMode: "auto",
    microphone: null,
    camera: null,
    game: null,
  }),
  updates: {
    state: async () => state,
    check: async () => emit({ status: "downloading", percent: 0 }),
    activity: async (busy) => emit({ busy }),
    install: async () => {
      emit({ status: "installing" });
      return { ok: true };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  },
};
createRoot(document.getElementById("root")!).render(
  <main className="min-h-screen bg-background p-8 text-foreground">
    <h1>Teste isolado — atualização do Desktop</h1>
    <p>Simulação visual, sem instalar ou publicar.</p>
    <div className="mt-8 flex gap-4">
      <button onClick={() => emit({ status: "downloading", percent: 42 })}>Download 42%</button>
      <button onClick={() => emit({ status: "ready", percent: 100 })}>Download concluído</button>
      <button onClick={() => reportDesktopCall("voice", true)}>Entrar em chamada</button>
      <button onClick={() => clearDesktopCall("voice")}>Sair da chamada</button>
      <button
        onClick={() =>
          emit({ status: "error", message: "Falha no download. Continue usando o LobbyX." })
        }
      >
        Falha de download
      </button>
    </div>
    <DesktopUpdates />
  </main>,
);
