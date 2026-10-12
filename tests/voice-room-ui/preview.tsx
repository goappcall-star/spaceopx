import { createRoot } from "react-dom/client";
import { AutoHideVoiceControls } from "@/components/voice/AutoHideVoiceControls";
import { VoiceStatusIcons } from "@/components/voice/VoiceStatusIcons";
import { VoiceIcon } from "@/components/voice/VoiceIcon";
import { VideoTile } from "@/components/voice/VideoTile";
import "@/styles.css";
document.documentElement.classList.add("dark");
function Preview() {
  return (
    <main style={{ height: "100vh" }} className="bg-background text-foreground flex">
      <aside className="bg-rail w-64 shrink-0 p-4">
        <h2 className="text-sm font-semibold">Lolizada</h2>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>Nicooo</span>
          <VoiceStatusIcons muted deafened={false} />
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span>Teste01</span>
          <VoiceStatusIcons muted deafened />
        </div>
      </aside>
      <AutoHideVoiceControls
        controls={
          <div className="bg-surface-elevated border-border flex justify-center gap-6 rounded-2xl border p-4">
            <button aria-label="Microfone">
              <VoiceIcon kind="mic" className="h-5 w-5" />
            </button>
            <button aria-label="Câmera">
              <VoiceIcon kind="camera" className="h-5 w-5" />
            </button>
            <button aria-label="Compartilhar tela">
              <VoiceIcon kind="screen" className="h-5 w-5" />
            </button>
            <button aria-label="Desconectar">
              <VoiceIcon kind="disconnect" className="h-5 w-5 text-destructive" />
            </button>
          </div>
        }
      >
        <header className="border-border border-b p-4 text-sm">
          Lolizada · prévia de interface
        </header>
        <section className="grid grid-cols-2 gap-4 p-4">
          {["Nicooo", "Teste01"].map((name) => (
            <VideoTile
              key={name}
              className="aspect-video"
              tile={{
                userId: name,
                name,
                stream: null,
                kind: "camera",
                isSelf: false,
                speaking: false,
                muted: true,
                deafened: name === "Teste01",
                screenSharing: false,
              }}
            />
          ))}
        </section>
      </AutoHideVoiceControls>
    </main>
  );
}
const previewRoot = createRoot(document.getElementById("root")!);
previewRoot.render(<Preview />);
if (import.meta.hot) import.meta.hot.dispose(() => previewRoot.unmount());
