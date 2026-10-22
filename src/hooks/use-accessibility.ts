import { useSyncExternalStore } from "react";
import {
  ACCESSIBILITY_KEY,
  DEFAULT_ACCESSIBILITY,
  normalizeAccessibility,
  accessibilityAttributes,
  type AccessibilityPreferences,
} from "@/lib/accessibility";
import "@/styles/accessibility.css";

let preferences = DEFAULT_ACCESSIBILITY;
let systemReduced = false;
let storageAvailable = true;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function apply() {
  if (typeof document !== "undefined")
    for (const [name, value] of Object.entries(accessibilityAttributes(preferences, systemReduced)))
      document.documentElement.setAttribute(name, value);
  listeners.forEach((listener) => listener());
}
function read() {
  try {
    preferences = normalizeAccessibility(
      JSON.parse(localStorage.getItem(ACCESSIBILITY_KEY) ?? "null"),
    );
    storageAvailable = true;
  } catch {
    preferences = DEFAULT_ACCESSIBILITY;
    storageAvailable = false;
  }
  apply();
}
export function setAccessibility(update: Partial<AccessibilityPreferences>) {
  preferences = normalizeAccessibility({ ...preferences, ...update });
  try {
    localStorage.setItem(ACCESSIBILITY_KEY, JSON.stringify(preferences));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
  apply();
}
export function useAccessibility() {
  return useSyncExternalStore(
    subscribe,
    () => preferences,
    () => DEFAULT_ACCESSIBILITY,
  );
}
export function useAccessibilityReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => preferences.reducedMotion || systemReduced,
    () => false,
  );
}
export function useAccessibilitySystemMotion() {
  return useSyncExternalStore(
    subscribe,
    () => systemReduced,
    () => false,
  );
}
export function useAccessibilityStorage() {
  return useSyncExternalStore(
    subscribe,
    () => storageAvailable,
    () => true,
  );
}

/** Focus existing landmarks only; does not add shortcuts to call handlers or capture keystrokes. */
export function focusAccessibilityLandmark(selector: string) {
  const target = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
    (element) =>
      element.getClientRects().length > 0 && !element.closest('[aria-hidden="true"], [inert]'),
  );
  if (!target) return;
  const previous = target.getAttribute("tabindex");
  target.setAttribute("tabindex", "-1");
  target.focus();
  target.addEventListener(
    "blur",
    () => {
      if (previous === null) target.removeAttribute("tabindex");
      else target.setAttribute("tabindex", previous);
    },
    { once: true },
  );
}
export function startAccessibilitySync() {
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const motion = () => {
    systemReduced = media.matches;
    apply();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === ACCESSIBILITY_KEY || event.key === null) read();
  };
  systemReduced = media.matches;
  read();
  media.addEventListener("change", motion);
  window.addEventListener("storage", storage);
  return () => {
    media.removeEventListener("change", motion);
    window.removeEventListener("storage", storage);
  };
}
