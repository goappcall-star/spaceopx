import { useEffect, useState } from "react";
import { toast } from "sonner";

export interface ServerPreferences {
  mutedUntil: number | null;
  notifications: "all" | "mentions" | "none";
  hideMutedChannels: boolean;
  mutedChannels: string[];
  mutedCategories: Record<string, number>;
  categoryNotifications: Record<string, "all" | "mentions" | "none">;
  channelNotifications: Record<string, "all" | "mentions" | "none">;
}
export const DEFAULT_SERVER_PREFERENCES: ServerPreferences = {
  mutedUntil: null,
  notifications: "all",
  hideMutedChannels: false,
  mutedChannels: [],
  mutedCategories: {},
  categoryNotifications: {},
  channelNotifications: {},
};
export function isServerMuted(preferences: ServerPreferences, now = Date.now()) {
  return preferences.mutedUntil === -1 || (preferences.mutedUntil ?? 0) > now;
}

export function useServerPreferences(userId: string | undefined) {
  const key = `lobbyx:server-preferences:${userId ?? "guest"}`;
  const [stored, setStored] = useState<{ key: string; values: Record<string, ServerPreferences> }>({
    key: "",
    values: {},
  });
  useEffect(() => {
    const load = () => {
      const values: Record<string, ServerPreferences> = {};
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? "{}");
        for (const [id, item] of Object.entries(raw ?? {})) {
          if (!item || typeof item !== "object") continue;
          const p = item as Partial<ServerPreferences>;
          values[id] = {
            mutedUntil: typeof p.mutedUntil === "number" ? p.mutedUntil : null,
            notifications:
              p.notifications === "mentions" || p.notifications === "none"
                ? p.notifications
                : "all",
            hideMutedChannels: p.hideMutedChannels === true,
            mutedChannels: Array.isArray(p.mutedChannels)
              ? p.mutedChannels.filter((id): id is string => typeof id === "string")
              : [],
            mutedCategories: Object.fromEntries(
              Object.entries(p.mutedCategories ?? {}).filter(
                ([, value]) => typeof value === "number",
              ),
            ),
            categoryNotifications: Object.fromEntries(
              Object.entries(p.categoryNotifications ?? {}).filter(([, value]) =>
                ["all", "mentions", "none"].includes(value),
              ),
            ),
            channelNotifications: Object.fromEntries(
              Object.entries(p.channelNotifications ?? {}).filter(([, value]) =>
                ["all", "mentions", "none"].includes(value),
              ),
            ),
          };
        }
      } catch {
        /* Defaults remain usable when storage is unavailable. */
      }
      setStored({ key, values });
    };
    load();
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, [key]);
  const values = stored.key === key ? stored.values : {};
  const get = (serverId: string) => values[serverId] ?? DEFAULT_SERVER_PREFERENCES;
  const update = (serverId: string, patch: Partial<ServerPreferences>) => {
    const next = { ...values, [serverId]: { ...get(serverId), ...patch } };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      toast.error("Não foi possível salvar as preferências neste navegador.");
      return;
    }
    setStored({ key, values: next });
  };
  return { get, update };
}
