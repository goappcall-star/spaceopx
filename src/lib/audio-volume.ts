/** One playback policy for microphone and screen audio. Never alters a received track. */
export function receivedAudioVolume(userPercent: number, outputPercent: number, deafened: boolean) {
  const user = Number.isFinite(userPercent) ? userPercent : 100;
  const output = Number.isFinite(outputPercent) ? outputPercent : 100;
  return deafened ? 0 : Math.max(0, Math.min(1, (user * output) / 10000));
}
