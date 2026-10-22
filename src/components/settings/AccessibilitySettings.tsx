import {
  useAccessibility,
  setAccessibility,
  useAccessibilitySystemMotion,
  useAccessibilityStorage,
} from "@/hooks/use-accessibility";
import { AccessibilitySettingsView } from "./AccessibilitySettingsView";
export function AccessibilitySettings() {
  const prefs = useAccessibility(),
    system = useAccessibilitySystemMotion(),
    storage = useAccessibilityStorage();
  return (
    <AccessibilitySettingsView
      preferences={prefs}
      systemReduced={system}
      storageAvailable={storage}
      onChange={setAccessibility}
    />
  );
}
