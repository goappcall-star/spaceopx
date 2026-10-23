import { useEffect, useState } from "react";
import { AppearanceSettingsView } from "@/components/settings/AppearanceSettingsView";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@/lib/appearance-settings";
import { resolvedTheme, type ThemeMode } from "@/lib/theme";
import type { VisualQuality } from "@/lib/visual-quality";
export function AppearancePreview({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState<AppearancePreferences>({
    ...APPEARANCE_DEFAULTS,
    accent_color: "neon_green" as const,
  });
  const [mode, setMode] = useState<ThemeMode>("dark"),
    [quality, setQuality] = useState<VisualQuality>("normal");
  const [systemDark, setSystemDark] = useState(true),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)"),
      motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setSystemDark(system.matches);
      setReduced(motion.matches);
    };
    update();
    system.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => {
      system.removeEventListener("change", update);
      motion.removeEventListener("change", update);
    };
  }, []);
  return (
    <div className="mx-auto w-full max-w-[1480px] px-5 py-8 sm:px-10 lg:px-14">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            PRÉVIA LOCAL · APENAS EM MEMÓRIA · SEM SUPABASE
          </p>
          <h1 className="text-2xl font-semibold">Aparência</h1>
          <p className="mt-2 text-sm text-muted-foreground">Deixe o LobbyX com a sua cara.</p>
        </div>
        <button type="button" className="text-xs text-primary underline" onClick={onBack}>
          Voltar à prévia
        </button>
      </div>
      <AppearanceSettingsView
        preferences={prefs}
        theme={mode}
        effectiveTheme={resolvedTheme(mode, systemDark)}
        quality={quality}
        reducedMotion={reduced}
        onPreference={(update) => setPrefs((current) => ({ ...current, ...update }))}
        onTheme={setMode}
        onQuality={setQuality}
        monitor={
          <button
            type="button"
            className="appearance-monitor-example"
            disabled
            title="Acesso administrativo indisponível na prévia sem autenticação"
          >
            ↗ Abrir Performance Monitor
          </button>
        }
      />
    </div>
  );
}
