import { useEffect, useSyncExternalStore } from "react";
import { resolveVisualQuality, VISUAL_QUALITY_KEY, type VisualQuality } from "@/lib/visual-quality";
let value: VisualQuality = "normal";
let pageHidden = false;
const listeners = new Set<() => void>();
function apply(saved?: string | null) {
  if (typeof window === "undefined") return;
  let preference = saved;
  if (preference === undefined) {
    try {
      preference = localStorage.getItem(VISUAL_QUALITY_KEY);
    } catch {
      preference = null;
    }
  }
  const next = resolveVisualQuality(
    preference,
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  document.documentElement.dataset["visualQuality"] = next;
  if (value !== next) {
    value = next;
    listeners.forEach((fn) => fn());
  }
}
export function setVisualQuality(next: VisualQuality) {
  try {
    localStorage.setItem(VISUAL_QUALITY_KEY, next);
  } catch {
    /* Session preference still works when storage is blocked. */
  }
  apply(next);
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export function useVisualQuality() {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => "normal" as VisualQuality,
  );
}
export function useMediaAnimations() {
  return useSyncExternalStore(
    subscribe,
    () => value === "normal" && !pageHidden,
    () => true,
  );
}
export function VisualQualitySync() {
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => apply();
    const storage = (event: StorageEvent) => {
      if (event.key === VISUAL_QUALITY_KEY || event.key === null) update();
    };
    const visibility = () => {
      pageHidden = document.hidden;
      listeners.forEach((fn) => fn());
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    update();
    motion.addEventListener("change", update);
    window.addEventListener("storage", storage);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", update);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return null;
}
