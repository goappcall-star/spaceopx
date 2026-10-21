import type { CSSProperties } from "react";
import type { Appearance } from "@/types/community-evolution";
export function appearanceStyle(a: Appearance): CSSProperties {
  return a.theme === "orbit_theme"
    ? ({
        "--primary": "oklch(0.72 0.20 300)",
        "--primary-hover": "oklch(0.78 0.18 300)",
        "--secondary": "oklch(0.80 0.22 125)",
      } as CSSProperties)
    : {};
}
