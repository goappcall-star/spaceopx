export const ACCESSIBILITY_KEY = "lobbyx:accessibility:v1";
export interface AccessibilityPreferences {
  text: "compact" | "normal" | "large";
  contrast: boolean;
  reducedMotion: boolean;
  focus: boolean;
  keyboard: boolean;
  reducedTransparency: boolean;
}
export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  text: "normal",
  contrast: false,
  reducedMotion: false,
  focus: false,
  keyboard: false,
  reducedTransparency: false,
};
export function normalizeAccessibility(value: unknown): AccessibilityPreferences {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    text: source["text"] === "compact" || source["text"] === "large" ? source["text"] : "normal",
    contrast: source["contrast"] === true,
    reducedMotion: source["reducedMotion"] === true,
    focus: source["focus"] === true,
    keyboard: source["keyboard"] === true,
    reducedTransparency: source["reducedTransparency"] === true,
  };
}
export function accessibilityAttributes(prefs: AccessibilityPreferences, systemReduced: boolean) {
  return {
    "data-a11y-text": prefs.text,
    "data-a11y-contrast": String(prefs.contrast),
    "data-a11y-motion": String(prefs.reducedMotion || systemReduced),
    "data-a11y-focus": String(prefs.focus),
    "data-a11y-keyboard": String(prefs.keyboard),
    "data-a11y-transparency": String(prefs.reducedTransparency),
  };
}
