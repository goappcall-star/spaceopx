import { useEffect, useRef, useState } from "react";
import { AccessibilitySettingsView } from "@/components/settings/AccessibilitySettingsView";
import { DEFAULT_ACCESSIBILITY, accessibilityAttributes } from "@/lib/accessibility";
import "@/styles/accessibility.css";
export function AccessibilityPreview({ onBack }: { onBack: () => void }) {
  const [prefs, setPrefs] = useState(DEFAULT_ACCESSIBILITY),
    [system, setSystem] = useState(false);
  const main = useRef<HTMLElement>(null),
    nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystem(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <div
      data-a11y-scope="true"
      {...accessibilityAttributes(prefs, system)}
      className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-10 lg:px-14"
      style={{ borderRadius: 16 }}
    >
      {prefs.keyboard && (
        <div className="a11y-skip-links">
          <button type="button" onClick={() => main.current?.focus()}>
            Ir para o conteúdo
          </button>
          <button type="button" onClick={() => nav.current?.focus()}>
            Ir para a navegação
          </button>
        </div>
      )}
      <nav
        ref={nav}
        tabIndex={-1}
        aria-label="Navegação da prévia"
        className="mb-6 flex items-center justify-between gap-3 text-xs text-muted-foreground"
      >
        <span>PRÉVIA LOCAL · AJUSTES EM MEMÓRIA · SEM SUPABASE</span>
        <button type="button" className="text-primary underline" onClick={onBack}>
          Voltar à prévia
        </button>
      </nav>
      <header className="mb-8">
        <p className="text-muted-foreground" style={{ fontSize: ".8em" }}>
          Configurações / Experiência
        </p>
        <h1 className="mt-2 font-semibold" style={{ fontSize: "2em" }}>
          Acessibilidade
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ajuste leitura, navegação e movimento para seu conforto.
        </p>
      </header>
      <main ref={main} tabIndex={-1}>
        <AccessibilitySettingsView
          preview
          preferences={prefs}
          systemReduced={system}
          onChange={(update) => setPrefs((current) => ({ ...current, ...update }))}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Nesta demonstração, os ajustes afetam somente esta área e não são salvos no dispositivo.
        </p>
      </main>
    </div>
  );
}
