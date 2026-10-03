export interface DetectedGame {
  id: string;
  name: string;
  startedAt: number;
}
export interface RegisteredGame {
  id: string;
  name: string;
  process: string;
  custom: boolean;
  enabled: boolean;
  lastPlayed: number | null;
}
export type DesktopPreferenceKey =
  | "activity"
  | "leagueMode"
  | "resetMedia"
  | "gameVisibility"
  | "addGame"
  | "removeGame"
  | "clearHistory";
export interface DesktopActivityState {
  catalog?: RegisteredGame[];
  detectedGame?: (DetectedGame & { catalogId: string }) | null;
  enabled: boolean;
  leagueMode: "auto" | "lol" | "tft";
  microphone: boolean | null;
  camera: boolean | null;
  game: DetectedGame | null;
}
declare global {
  interface Window {
    lobbyxDesktop?: {
      activity: () => Promise<DesktopActivityState>;
      preference: (
        key: DesktopPreferenceKey,
        value?:
          boolean | string | { id: string; enabled: boolean } | { name: string; process: string },
      ) => Promise<DesktopActivityState>;
    };
  }
}
export function readDetectedGames(
  state: Record<string, Array<{ user_id?: string; at?: number; game?: unknown }>>,
) {
  const result: Record<string, DetectedGame> = {};
  for (const rows of Object.values(state)) {
    for (const row of [...rows].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))) {
      const game = row.game as Partial<DetectedGame> | null;
      if (
        !row.user_id ||
        result[row.user_id] ||
        !game ||
        typeof game.id !== "string" ||
        typeof game.name !== "string" ||
        typeof game.startedAt !== "number"
      )
        continue;
      if (
        game.name.length > 80 ||
        !Number.isFinite(game.startedAt) ||
        game.startedAt > Date.now() + 60000 ||
        game.startedAt < 0
      )
        continue;
      result[row.user_id] = {
        id: game.id.slice(0, 64),
        name: game.name,
        startedAt: game.startedAt,
      };
    }
  }
  return result;
}
export function gameElapsed(startedAt: number, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return "há " + minutes + " min";
  return (
    "há " + Math.floor(minutes / 60) + " h" + (minutes % 60 ? " " + (minutes % 60) + " min" : "")
  );
}
