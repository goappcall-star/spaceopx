export interface DesktopUpdateState {
  status: "idle" | "checking" | "downloading" | "ready" | "installing" | "error";
  currentVersion: string;
  version: string | null;
  percent: number;
  busy: boolean;
  message: string | null;
}
const calls = new Map<string, boolean>();
let installing = false;
export const desktopCallBusy = () => [...calls.values()].some(Boolean);
export function reportDesktopCall(source: string, busy: boolean) {
  calls.set(source, busy);
  void window.lobbyxDesktop?.updates?.activity(desktopCallBusy()).catch(() => {});
}
export function beginDesktopCall(source: string) {
  if (installing) throw Error("O LobbyX está reiniciando para atualizar.");
  reportDesktopCall(source, true);
}
export function clearDesktopCall(source: string) {
  calls.delete(source);
  void window.lobbyxDesktop?.updates?.activity(desktopCallBusy()).catch(() => {});
}
export async function installDesktopUpdate() {
  const api = window.lobbyxDesktop?.updates;
  if (!api || desktopCallBusy() || installing)
    return { ok: false, message: "Encerre a chamada antes de atualizar." };
  installing = true;
  try {
    await api.activity(false);
    const result = await api.install();
    if (!result.ok) installing = false;
    return result;
  } catch {
    installing = false;
    return { ok: false, message: "Não foi possível iniciar a atualização. Tente novamente." };
  }
}
export function unlockDesktopUpdate() {
  installing = false;
}
