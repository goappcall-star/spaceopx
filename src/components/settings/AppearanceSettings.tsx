import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePreferences } from "@/hooks/use-gamer";
import { useTheme } from "@/hooks/use-theme";
import { useVisualQuality, setVisualQuality } from "@/hooks/use-visual-quality";
import { preferencesService } from "@/services/gamer";
import { AdminMonitorLink } from "@/components/performance/AdminMonitorLink";
import { APPEARANCE_DEFAULTS, type AppearancePreferences } from "@/lib/appearance-settings";
import { resolvedTheme } from "@/lib/theme";
import { AppearanceSettingsView } from "./AppearanceSettingsView";

export function AppearanceSettings() {
  const { user } = useAuth();
  return <AppearanceEditor key={user?.id ?? "signed-out"} />;
}
function AppearanceEditor() {
  const { user } = useAuth();
  const prefs = usePreferences(user?.id);
  const query = useQueryClient();
  const { mode, setMode } = useTheme();
  const quality = useVisualQuality();
  const [systemDark, setSystemDark] = useState(true),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const dark = matchMedia("(prefers-color-scheme: dark)"),
      motion = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setSystemDark(dark.matches);
      setReduced(motion.matches);
    };
    update();
    dark.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => {
      dark.removeEventListener("change", update);
      motion.removeEventListener("change", update);
    };
  }, []);
  const mutation = useMutation({
    mutationFn: async (update: Partial<AppearancePreferences>) => {
      if (!user || !prefs.data) throw Error("Preferências indisponíveis.");
      await preferencesService.save(user.id, update);
    },
    onSuccess: async () => {
      await query.invalidateQueries({ queryKey: ["preferences", user?.id] });
    },
  });
  return (
    <AppearanceSettingsView
      preferences={prefs.data ?? APPEARANCE_DEFAULTS}
      theme={mode}
      effectiveTheme={resolvedTheme(mode, systemDark)}
      quality={quality}
      reducedMotion={reduced}
      disabled={!prefs.data || prefs.isError || mutation.isPending}
      onPreference={(update) => mutation.mutate(update)}
      onTheme={setMode}
      onQuality={setVisualQuality}
      monitor={<AdminMonitorLink />}
      error={
        prefs.isError
          ? "Não foi possível carregar suas preferências. Reabra esta aba para tentar novamente."
          : mutation.isError
            ? "Não foi possível salvar a personalização. Tente novamente."
            : undefined
      }
      feedback={
        prefs.isPending
          ? "Carregando preferências..."
          : mutation.isPending
            ? "Salvando personalização..."
            : mutation.isSuccess
              ? "Personalização salva."
              : undefined
      }
    />
  );
}
