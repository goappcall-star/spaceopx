import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { usePreferences } from "@/hooks/use-gamer";

/**
 * Applies the user's visual preferences as data-attributes on <html>.
 * Only whitelisted enum values are ever written — never user-supplied CSS.
 */
export function AppearanceSync() {
  const { user } = useAuth();
  const { data: prefs } = usePreferences(user?.id);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset["accent"] = prefs?.accent_color ?? "neon_cyan";
    root.dataset["glow"] = String(prefs?.glow_enabled ?? true);
    root.dataset["animations"] = String(prefs?.animations_enabled ?? true);
    root.dataset["transparency"] = prefs?.transparency_level ?? "medium";
  }, [prefs]);

  return null;
}
