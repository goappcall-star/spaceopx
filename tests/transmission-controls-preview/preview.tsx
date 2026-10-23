import { createRoot } from "react-dom/client";
import { VoiceControlBar } from "@/components/voice/VoiceControlBar";
import { CallOverlay } from "@/components/call/CallOverlay";
import { ScreenViewingProvider, useScreenViewing } from "@/components/call/ScreenViewingProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreviewProviders, usePreview } from "./fixtures";
import "@/styles.css";
document.documentElement.classList.add("dark");
function Preview() {
  const c = usePreview(),
    view = useScreenViewing();
  return (
    <main className="min-h-screen bg-background text-foreground p-6 space-y-6">
      <header>
        <p className="text-primary text-xs">
          PRÉVIA LOCAL · DADOS FICTÍCIOS · SEM CHAMADA OU CAPTURA REAL
        </p>
        <h1 className="text-2xl font-semibold my-3">Controles de transmissão</h1>
        <div className="flex gap-3">
          <button className="border rounded-lg p-2" onClick={() => c.setLocal(true)}>
            Simular minha transmissão
          </button>
          <button className="border rounded-lg p-2" onClick={() => c.setRemote(!c.remote)}>
            {c.remote ? "Simular parada remota" : "Simular transmissão remota"}
          </button>
        </div>
      </header>
      <section
        aria-label="Hotbar do servidor"
        className="border border-border rounded-2xl p-5 space-y-5"
      >
        <h2>Canal de voz · hotbar real</h2>
        <p role="status">
          {c.remote
            ? view.voicePaused
              ? "Você saiu da transmissão. A voz da chamada continua."
              : "Assistindo à transmissão fictícia."
            : "Nenhuma transmissão remota."}
        </p>
        <VoiceControlBar />
      </section>
      <section aria-label="Chamada privada" className="border border-border rounded-2xl p-5">
        <h2>Chamada privada · painel real com streams vazios</h2>
        <CallOverlay />
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <PreviewProviders>
    <ScreenViewingProvider>
      <TooltipProvider>
        <Preview />
      </TooltipProvider>
    </ScreenViewingProvider>
  </PreviewProviders>,
);
