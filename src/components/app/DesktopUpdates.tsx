import { useEffect, useState } from "react";
import {
  desktopCallBusy,
  installDesktopUpdate,
  unlockDesktopUpdate,
  type DesktopUpdateState,
} from "@/services/desktop-updates";
import { Button } from "@/components/ui/button";
export function DesktopUpdates() {
  const [state, setState] = useState<DesktopUpdateState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const api = window.lobbyxDesktop?.updates;
    if (!api) return;
    let alive = true;
    const receive = (next: DesktopUpdateState) => {
      if (!alive) return;
      setState(next);
      if (next.status === "error") unlockDesktopUpdate();
    };
    const stop = api.subscribe(receive);
    void api
      .state()
      .then(receive)
      .catch(() => {});
    const heartbeat = () => {
      void api
        .activity(desktopCallBusy())
        .then(receive)
        .catch(() => {});
    };
    heartbeat();
    const timer = setInterval(heartbeat, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
      stop();
    };
  }, []);
  if (!state || state.status === "idle" || state.status === "checking") return null;
  return (
    <section
      className="fixed right-4 top-4 z-[100] w-80 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl"
      aria-label="Atualização do LobbyX"
    >
      <p className="text-sm font-semibold" role="status" aria-live="polite">
        {state.status === "ready"
          ? "Atualização pronta"
          : state.status === "installing"
            ? "Reiniciando para atualizar…"
            : state.status === "error"
              ? "Atualização indisponível"
              : `Baixando atualização: ${Math.floor(state.percent)}%`}
      </p>
      {state.version && (
        <p className="mt-1 text-xs text-muted-foreground">LobbyX {state.version}</p>
      )}
      {state.status === "downloading" && (
        <progress
          className="mt-3 w-full accent-primary"
          max={100}
          value={state.percent}
          aria-label="Progresso do download"
        />
      )}
      {state.status === "ready" && (
        <>
          {state.busy && (
            <p className="mt-2 text-xs text-muted-foreground">
              Encerre a chamada e o compartilhamento de tela para atualizar.
            </p>
          )}
          <Button
            className="mt-3 w-full"
            disabled={state.busy}
            onClick={async () => {
              const result = await installDesktopUpdate();
              if (!result.ok) setMessage(result.message ?? "Não foi possível atualizar.");
            }}
          >
            Reiniciar e atualizar
          </Button>
        </>
      )}
      {state.status === "error" && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{state.message}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => {
              setMessage(null);
              void window.lobbyxDesktop?.updates?.check().catch(() => {});
            }}
          >
            Tentar novamente
          </Button>
        </>
      )}
      {message && (
        <p className="mt-2 text-xs" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
