// UI fixture only; not part of the deployed route or its authorization. All metric values are measured.
import { createRoot } from "react-dom/client";
import { PerformanceMonitorPanel } from "../../src/components/performance/PerformanceMonitorPanel";
import { monitoredFetch } from "../../src/services/performance/monitor";
import "../../src/styles.css";
createRoot(document.getElementById("root")!).render(
  <>
    <header className="flex flex-wrap gap-4 border-b p-4 text-sm text-foreground">
      <span>Fixture local de UI — sem login, sem Supabase, sem dados de usuários</span>
      <button
        onClick={async () => {
          for (let i = 0; i < 10; i++)
            await monitoredFetch("/tests/monitor/panel.html?sample=" + i);
        }}
      >
        Medir 10 requests locais reais
      </button>
      <button
        onClick={() => {
          const dark = document.documentElement.classList.toggle("dark");
          document.documentElement.classList.toggle("light", !dark);
        }}
      >
        Alternar tema
      </button>
    </header>
    <PerformanceMonitorPanel onBack={() => location.assign("/tests/monitor/index.html")} />
  </>,
);
