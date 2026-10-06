import { Avatar, AvatarImage, AvatarFallback } from "../../src/components/ui/avatar";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { PerformanceSettings } from "../../src/components/settings/PerformanceSettings";
import { VisualQualitySync, useVisualQuality } from "../../src/hooks/use-visual-quality";
import { AnimeFrame } from "../../src/components/gamer/AnimeFrame";
import { FlamingCutFrame } from "../../src/components/gamer/FlamingCutFrame";
import "../../src/styles.css";
function App() {
  const mode = useVisualQuality();
  const [stats, setStats] = useState("");
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let writes = 0;
    const observer = new MutationObserver((records) => {
      writes += records.filter((r) => r.attributeName === "d").length;
    });
    observer.observe(host.current!, { attributes: true, subtree: true, attributeFilter: ["d"] });
    const start = performance.now();
    const timer = setTimeout(() => {
      const active = document.getAnimations().filter((a) => a.playState === "running").length;
      setStats(
        JSON.stringify({
          mode,
          seconds: (performance.now() - start) / 1000,
          pathWrites: writes,
          activeAnimations: active,
          domNodes: document.querySelectorAll("*").length,
        }),
      );
      observer.disconnect();
    }, 2500);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [mode]);
  return (
    <>
      <VisualQualitySync />
      <PerformanceSettings />
      <Avatar>
        <AvatarImage src="./test.gif" alt="GIF de teste" />
        <AvatarFallback>GIF</AvatarFallback>
      </Avatar>
      <pre id="metrics">{stats}</pre>
      <div ref={host} style={{ display: "flex", flexWrap: "wrap", gap: 30 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="glass-panel relative shadow-xl"
            style={{ width: 220, height: 290 }}
          >
            <h2>Perfil {i + 1}</h2>
            {i % 2 ? <AnimeFrame theme="celestial-energy" /> : <FlamingCutFrame />}
          </div>
        ))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
