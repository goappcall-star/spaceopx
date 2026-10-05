import { useEffect } from "react";

import { useAuth } from "@/hooks/use-auth";
import { usePreferences } from "@/hooks/use-gamer";
import { useTheme } from "@/hooks/use-theme";
import { resolvedTheme } from "@/lib/theme";

/**
 * Applies the user's visual preferences as data-attributes on <html>.
 * Only whitelisted enum values are ever written — never user-supplied CSS.
 */
export function AppearanceSync() {
  const { user } = useAuth();
  const { data: prefs } = usePreferences(user?.id);
  const { mode } = useTheme();
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = resolvedTheme(mode, media.matches);
      const root = document.documentElement;
      root.classList.toggle("dark", theme === "dark");
      root.classList.toggle("light", theme === "light");
      root.style.colorScheme = theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset["accent"] = prefs?.accent_color ?? "neon_cyan";
    root.dataset["glow"] = String(prefs?.glow_enabled ?? true);
    root.dataset["animations"] = String(prefs?.animations_enabled ?? true);
    root.dataset["transparency"] = prefs?.transparency_level ?? "medium";
  }, [prefs]);

  return null;
}
