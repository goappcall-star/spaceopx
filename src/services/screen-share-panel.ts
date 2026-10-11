type Target = "voice" | "call" | null;
let target: Target = null;
const listeners = new Set<() => void>();
export function openScreenSharePanel(next: Target) {
  target = next;
  listeners.forEach((fn) => fn());
}
export const subscribeScreenPanel = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const screenPanelTarget = () => target;
