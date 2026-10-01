const CATALOG = [
  { id: "valorant", name: "VALORANT", processes: ["valorant-win64-shipping.exe"] },
  { id: "cs2", name: "Counter-Strike 2", processes: ["cs2.exe"] },
  { id: "csgo", name: "Counter-Strike: Global Offensive", processes: ["csgo.exe"] },
  {
    id: "palworld",
    name: "Palworld",
    processes: ["palworld-win64-shipping.exe", "palworld-wingdk-shipping.exe"],
  },
  { id: "aniimo", name: "Aniimo", processes: ["aniimo.exe"] },
  { id: "league", name: "League of Legends / TFT", processes: ["league of legends.exe"] },
];
function detectGame(rows, previous, leagueMode = "auto", now = Date.now(), catalog = CATALOG) {
  const found = [];
  for (const row of rows) {
    const entry = catalog.find((game) => game.processes.includes(row.name.toLowerCase()));
    if (!entry) continue;
    const game =
      entry.id === "league" && leagueMode !== "auto"
        ? {
            ...entry,
            id: leagueMode,
            name: leagueMode === "tft" ? "Teamfight Tactics" : "League of Legends",
          }
        : entry;
    const identity = game.id + ":" + row.pid;
    found.push({
      id: game.id,
      name: game.name,
      identity,
      startedAt: previous?.identity === identity ? previous.startedAt : now,
    });
  }
  return found.find((game) => game.identity === previous?.identity) ?? found[0] ?? null;
}
function parseTasks(csv) {
  return csv.split(/\r?\n/).flatMap((line) => {
    const match = /^"([^"]+)","(\d+)"/.exec(line);
    return match ? [{ name: match[1], pid: Number(match[2]) }] : [];
  });
}
module.exports = { CATALOG, detectGame, parseTasks };

module.exports.validateCustomGame = (input, catalog = CATALOG) => {
  if (!input || typeof input.name !== "string" || typeof input.process !== "string")
    throw Error("Informe nome e executável.");
  const name = input.name.trim(),
    processName = input.process.trim().toLowerCase();
  if (!name || name.length > 60 || !/^[a-z0-9 _().-]{1,100}\.exe$/i.test(processName))
    throw Error("Use apenas o nome do arquivo .exe, sem caminho de pastas.");
  if (catalog.some((game) => game.processes.includes(processName)))
    throw Error("Este executável já está registrado.");
  return { name, processes: [processName] };
};
