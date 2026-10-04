import type { NoiseSuppressionMode } from "./audio-processing";
export function readNoiseMode(userId: string): NoiseSuppressionMode {
  try {
    const saved = localStorage.getItem(`lobbyx:noise-mode:${userId}`);
    if (saved === "off" || saved === "standard" || saved === "advanced") return saved;
    return localStorage.getItem(`lobbyx:noise-suppression:${userId}`) === "false"
      ? "off"
      : "standard";
  } catch {
    return "standard";
  }
}
export function saveNoiseMode(userId: string, mode: NoiseSuppressionMode) {
  try {
    localStorage.setItem(`lobbyx:noise-mode:${userId}`, mode);
  } catch {
    /* Session preference still works. */
  }
}
