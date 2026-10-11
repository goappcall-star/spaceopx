import { useSyncExternalStore } from "react";

// Local playback preferences only: no signaling, polling or database writes.
// Shared by the player and its controls, including the fullscreen view.
const defaults: Readonly<Record<string, number>> = Object.freeze({});
let volumes = defaults;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setScreenVolume(userId: string, percent: number) {
  if (!userId || !Number.isFinite(percent)) return;
  const next = Math.max(0, Math.min(100, percent));
  if ((volumes[userId] ?? 100) === next) return;
  const entries = Object.entries(volumes)
    .filter(([id]) => id !== userId)
    .slice(-63);
  volumes = Object.freeze(Object.fromEntries([...entries, [userId, next]]));
  listeners.forEach((listener) => listener());
}

export function useScreenVolumes() {
  return useSyncExternalStore(
    subscribe,
    () => volumes,
    () => defaults,
  );
}
