import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FlamingCutFrame } from "../../src/components/gamer/FlamingCutFrame";
import { IllustratedFrame } from "../../src/components/gamer/IllustratedFrame";
import { FRAME_PALETTES, type IllustratedFrameId } from "../../src/lib/illustrated-frames";
import { VisualQualitySync, setVisualQuality } from "../../src/hooks/use-visual-quality";
import "../../src/styles.css";
const names = {
  aurora: "Aurora",
  cosmic: "Voo noturno",
  royal: "Imperial",
  sakura: "Flor de cerejeira",
  "shadow-rise": "Ascensão Sombria",
  "celestial-energy": "Energia Celestial",
  "void-eye": "Olho do Vazio",
  thunderstorm: "Tempestade do Trovão",
  "crimson-moon": "Lua Carmesim",
};
function Preview() {
  const [animated, setAnimated] = useState(true);
  const [mode, setMode] = useState<"normal" | "optimized">("normal");
  useEffect(() => {
    setVisualQuality(mode);
  }, [mode]);
  return (
    <>
      <VisualQualitySync />
      <header
        style={{ position: "sticky", top: 0, zIndex: 100, padding: 20, background: "#0b1019" }}
      >
        <h1 className="text-xl font-bold">LobbyX · Molduras V2</h1>
        <p>Prévia com perfis fictícios · mesmos assets e trajetórias</p>
        <label className="mr-5">
          <input
            type="checkbox"
            checked={animated}
            onChange={(e) => setAnimated(e.target.checked)}
          />{" "}
          Animações das molduras
        </label>
        <button
          onClick={() => setMode(mode === "normal" ? "optimized" : "normal")}
          className="rounded bg-primary px-3 py-1 text-primary-foreground"
        >
          {mode === "normal" ? "Ativar Modo Desempenho" : "Desativar Modo Desempenho"}
        </button>
      </header>
      <main
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, 225px)",
          gap: 80,
          padding: 64,
        }}
      >
        {["flame", ...Object.keys(FRAME_PALETTES)].map((theme) => (
          <article
            key={theme}
            className="bg-surface relative rounded-3xl border p-6"
            style={{ width: 225, height: 305, padding: 24, background: "#121a27" }}
          >
            <div
              style={{
                height: 96,
                borderRadius: 16,
                background: "linear-gradient(135deg,#321251,#174782)",
              }}
            />
            <h2 className="mt-6 font-bold">
              {theme === "flame" ? "Corte Flamejante" : names[theme as IllustratedFrameId]}
            </h2>
            <p className="mt-2 text-sm">Perfil fictício · overlay preservado</p>
            {theme === "flame" ? (
              <FlamingCutFrame animated={animated} />
            ) : (
              <IllustratedFrame theme={theme as IllustratedFrameId} animated={animated} />
            )}
          </article>
        ))}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Preview />);
