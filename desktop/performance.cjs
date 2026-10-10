// Aggregate only LobbyX processes; do not expose PIDs, paths, names or command lines.
exports.installPerformance = ({
  app,
  window,
  ipcMain,
  trusted,
  clock = () => performance.now(),
  wallClock = () => Date.now(),
}) => {
  let sequence = 0;
  let last = -Infinity,
    cached = null;
  let previous = new Map();
  let lastWall;
  ipcMain.handle("desktop:performance", (event) => {
    if (
      window.isDestroyed() ||
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      !trusted(event.senderFrame.url)
    )
      throw Error("Forbidden");
    const now = clock();
    // Shorter than the renderer's 60s cadence: avoid dropping a boundary sample.
    if (cached && now - last < 30000) return cached;
    const wall = wallClock();
    const processes = app.getAppMetrics();
    const next = new Map();
    let seconds = 0;
    let comparable = !!cached;
    for (const p of processes) {
      const key = p.pid + ":" + p.creationTime;
      const total = p.cpu?.cumulativeCPUUsage;
      const before = previous.get(key);
      next.set(key, total);
      if (!Number.isFinite(total)) comparable = false;
      else if (Number.isFinite(before) && total >= before) seconds += total - before;
      else if (
        cached &&
        !previous.has(key) &&
        Number.isFinite(p.creationTime) &&
        Math.abs(wall - lastWall - (now - last)) < 1000 &&
        p.creationTime >= lastWall &&
        p.creationTime <= wall
      )
        seconds += total; // Born inside interval: its lifetime CPU belongs here.
      else comparable = false;
    }
    if ([...previous.keys()].some((key) => !next.has(key))) comparable = false;
    cached = {
      version: app.getVersion(),
      sampleId: ++sequence,
      // Independent of calls by other diagnostics/dependencies. Never fabricate first-sample CPU.
      cpu: comparable && now > last ? (seconds * 100000) / (now - last) : null,
      memory:
        processes.reduce(
          (sum, p) => sum + (p.memory?.privateBytes ?? p.memory?.workingSetSize ?? 0),
          0,
        ) / 1024,
    };
    previous = next;
    last = now;
    lastWall = wall;
    return cached;
  });
  return () => ipcMain.removeHandler("desktop:performance");
};
