import { useSyncExternalStore } from "react";
import { normalizeTheme, THEME_KEY, type ThemeMode } from "@/lib/theme";
const eventName = "lobbyx:theme-change";
function snapshot() {
  try {
    return normalizeTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "dark" as const;
  }
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) listener();
  };
  window.addEventListener(eventName, listener);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(eventName, listener);
    window.removeEventListener("storage", storage);
  };
}
export function useTheme() {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "dark" as const);
  const setMode = (next: ThemeMode) => {
    try {
      localStorage.setItem(THEME_KEY, normalizeTheme(next));
    } catch {
      return;
    }
    window.dispatchEvent(new Event(eventName));
  };
  return { mode, setMode };
}
