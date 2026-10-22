import type { AccentColor, TransparencyLevel } from "@/types";
import type { VisualQuality } from "./visual-quality";
export interface AppearancePreferences {
  accent_color: AccentColor;
  transparency_level: TransparencyLevel;
  glow_enabled: boolean;
  animations_enabled: boolean;
  frame_animations_enabled: boolean;
}
export const APPEARANCE_ACCENTS: { value: AccentColor; label: string; color: string }[] = [
  { value: "neon_green", label: "Verde", color: "#47e98b" },
  { value: "neon_blue", label: "Azul", color: "#659afb" },
  { value: "neon_purple", label: "Roxo", color: "#ab72ff" },
  { value: "neon_cyan", label: "Ciano", color: "#5bded1" },
  { value: "neon_orange", label: "Laranja", color: "#ff9b43" },
  { value: "neon_red", label: "Vermelho", color: "#fa526d" },
];
export const APPEARANCE_QUALITIES: { value: VisualQuality; label: string; description: string }[] =
  [
    { value: "optimized", label: "Otimizado", description: "Menos efeitos" },
    { value: "normal", label: "Normal", description: "Visual completo" },
    { value: "maximum", label: "Desempenho Máximo", description: "Máximo desempenho" },
  ];
export const APPEARANCE_DEFAULTS: AppearancePreferences = {
  accent_color: "neon_cyan",
  transparency_level: "medium",
  glow_enabled: true,
  animations_enabled: true,
  frame_animations_enabled: true,
};
export function appearancePreviewPolicy(
  prefs: AppearancePreferences,
  quality: VisualQuality,
  reducedMotion: boolean,
) {
  return {
    glow: prefs.glow_enabled && quality === "normal",
    animations: prefs.animations_enabled && quality !== "maximum" && !reducedMotion,
    frames:
      prefs.frame_animations_enabled &&
      prefs.animations_enabled &&
      quality === "normal" &&
      !reducedMotion,
    alpha: ({ none: 1, low: 0.94, medium: 0.82, high: 0.66 } as const)[prefs.transparency_level],
    accent:
      APPEARANCE_ACCENTS.find((accent) => accent.value === prefs.accent_color)?.color ??
      APPEARANCE_ACCENTS[3]!.color,
  };
}
