const { ipcMain, dialog } = require("electron");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { randomUUID } = require("node:crypto");
const { CATALOG, detectGame, parseTasks, validateCustomGame } = require("./game-catalog.cjs");
const run = promisify(execFile);
const path = require("node:path");
exports.installActivity = ({ window, store, trusted }) => {
  let lastPoll = 0,
    current = null,
    reading = false,
    permissionPrompt = null,
    disposed = false;
  const custom = () => (Array.isArray(store.get("customGames")) ? store.get("customGames") : []);
  const catalog = () => [...CATALOG, ...custom()];
  const catalogId = (game) => (["lol", "tft"].includes(game?.id) ? "league" : game?.id);
  const disabled = () => (Array.isArray(store.get("hiddenGames")) ? store.get("hiddenGames") : []);
  const publicGame = (game) =>
    game ? { id: game.id, name: game.name, startedAt: game.startedAt } : null;
  const valid = (event) =>
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    trusted(event.senderFrame.url);
  const snapshot = () => ({
    enabled: store.get("activity") === true,
    leagueMode: store.get("leagueMode") ?? "auto",
    microphone: store.get("audio") ?? null,
    camera: store.get("video") ?? null,
    game:
      store.get("activity") === true && !disabled().includes(catalogId(current))
        ? publicGame(current)
        : null,
    detectedGame: current ? { ...publicGame(current), catalogId: catalogId(current) } : null,
    catalog: catalog().map((game) => ({
      id: game.id,
      name: game.name,
      process: game.processes[0],
      custom: game.id.startsWith("custom-"),
      enabled: !disabled().includes(game.id),
      lastPlayed: store.get("gameHistory")?.[game.id] ?? null,
    })),
  });
  async function poll() {
    if (reading || disposed || Date.now() - lastPoll < 5000) return;
    if (store.get("activity") !== true) {
      current = null;
      return;
    }
    reading = true;
    lastPoll = Date.now();
    try {
      const { stdout } = await run(
        path.join(process.env.SystemRoot || "C:/Windows", "System32", "tasklist.exe"),
        ["/FO", "CSV", "/NH"],
        { windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024 },
      );
      if (store.get("activity") !== true || disposed) return;
      const next = detectGame(
        parseTasks(stdout),
        current,
        store.get("leagueMode") ?? "auto",
        Date.now(),
        catalog(),
      );
      if (next?.identity !== current?.identity) {
        const history = { ...(store.get("gameHistory") ?? {}) };
        if (current) history[catalogId(current)] = Date.now();
        if (next) history[catalogId(next)] = Date.now();
        await store.set("gameHistory", history);
      }
      if (store.get("activity") === true && !disposed) current = next;
    } catch {
      current = null;
    } finally {
      reading = false;
    }
  }
  ipcMain.handle("desktop:activity", async (event) => {
    if (!valid(event)) throw Error("Forbidden");
    if (store.get("activity") === undefined) {
      if (!permissionPrompt)
        permissionPrompt = (async () => {
          const result = await dialog.showMessageBox(window, {
            type: "question",
            title: "Atividade de jogos",
            message:
              "Permitir que o LobbyX detecte seus jogos e mostre no perfil o que você está jogando e há quanto tempo?",
            detail:
              "A lista de processos fica neste computador. Apenas o jogo reconhecido e o horário de início são compartilhados enquanto o LobbyX estiver aberto. Você pode desativar nas configurações.",
            buttons: ["Agora não", "Permitir"],
            defaultId: 0,
            cancelId: 0,
          });
          await store.set("activity", result.response === 1);
        })().finally(() => {
          permissionPrompt = null;
        });
      await permissionPrompt;
    }
    await poll();
    return snapshot();
  });
  ipcMain.handle("desktop:preferences", async (event, change) => {
    if (!valid(event)) throw Error("Forbidden");
    if (change?.key === "activity" && typeof change.value === "boolean") {
      await store.set("activity", change.value);
      if (!change.value) current = null;
    } else if (change?.key === "leagueMode" && ["auto", "lol", "tft"].includes(change.value)) {
      await store.set("leagueMode", change.value);
      current = null;
    } else if (
      change?.key === "gameVisibility" &&
      typeof change.value?.enabled === "boolean" &&
      catalog().some((game) => game.id === change.value.id)
    ) {
      const hidden = disabled().filter((id) => id !== change.value.id);
      if (!change.value.enabled) hidden.push(change.value.id);
      await store.set("hiddenGames", hidden);
    } else if (change?.key === "addGame") {
      if (custom().length >= 50) throw Error("Limite de 50 jogos personalizados.");
      const game = validateCustomGame(change.value, catalog());
      await store.set("customGames", [...custom(), { ...game, id: "custom-" + randomUUID() }]);
    } else if (change?.key === "removeGame" && custom().some((game) => game.id === change.value)) {
      await store.set(
        "customGames",
        custom().filter((game) => game.id !== change.value),
      );
      if (current?.id === change.value) current = null;
    } else if (change?.key === "clearHistory") {
      await store.set("gameHistory", {});
    } else if (change?.key === "resetMedia") {
      await store.set("audio", null);
      await store.set("video", null);
    } else throw Error("Invalid preference");
    lastPoll = 0;
    await poll();
    return snapshot();
  });
  const timer = setInterval(() => void poll(), 10000);
  return () => {
    disposed = true;
    clearInterval(timer);
    ipcMain.removeHandler("desktop:activity");
    ipcMain.removeHandler("desktop:preferences");
  };
};
