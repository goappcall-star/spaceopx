/** Normalize global hardware gain, including legacy preferences and non-finite values. */
export function clampGlobalVolume(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 100;
}

/** One playback policy for microphone and screen audio. Never alters a received track. */
export function receivedAudioVolume(userPercent: number, outputPercent: number, deafened: boolean) {
  const user = Number.isFinite(userPercent) ? userPercent : 100;
  const output = clampGlobalVolume(outputPercent);
  return deafened ? 0 : Math.max(0, Math.min(1, (user * output) / 10000));
}
