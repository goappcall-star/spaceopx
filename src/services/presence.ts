export interface PresenceRow {
  user_id: string;
  status: "online" | "idle" | "dnd" | "offline";
  at?: number;
}

/** Only live sessions count. Use the latest announcement when multiple tabs exist. */
export function resolvePresence(state: Record<string, PresenceRow[]>) {
  const latest: Record<string, PresenceRow> = {};
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (!entry.user_id) continue;
      if (!latest[entry.user_id] || (entry.at ?? 0) > (latest[entry.user_id]?.at ?? 0))
        latest[entry.user_id] = entry;
    }
  }
  const statuses: Record<string, PresenceRow["status"]> = {};
  for (const [id, entry] of Object.entries(latest)) {
    statuses[id] = ["online", "idle", "dnd"].includes(entry.status) ? entry.status : "offline";
  }
  return statuses;
}
