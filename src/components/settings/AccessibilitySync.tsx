import { useEffect } from "react";
import {
  useAccessibility,
  startAccessibilitySync,
  focusAccessibilityLandmark,
} from "@/hooks/use-accessibility";
export function AccessibilitySync() {
  const prefs = useAccessibility();
  useEffect(() => startAccessibilitySync(), []);
  return prefs.keyboard ? (
    <div className="a11y-skip-links" aria-label="Atalhos de navegação">
      <button type="button" onClick={() => focusAccessibilityLandmark("main, [role='main']")}>
        Ir para o conteúdo
      </button>
      <button
        type="button"
        onClick={() => focusAccessibilityLandmark("nav, [role='navigation'], .settings-sidebar")}
      >
        Ir para a navegação
      </button>
    </div>
  ) : null;
}
