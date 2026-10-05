// Real electron-updater download against loopback, without launching an installer.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Transform } from "node:stream";
import assert from "node:assert/strict";
import { verifyDesktopRelease } from "./verify-desktop-release.mjs";
const require = createRequire(import.meta.url);
const { NsisUpdater } = require("electron-updater");
const { NodeHttpExecutor } = require("builder-util/out/nodeHttpExecutor");
const { ElectronHttpExecutor } = require("electron-updater/out/electronHttpExecutor");
const { load, dump } = require("js-yaml");
const { createUpdateController } = require("../desktop/updater.cjs");
const release = await verifyDesktopRelease();
const metadata = load(await fs.readFile(release.metadata, "utf8"));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "lobbyx-update-test-"));
let badChecksum = false;
const server = createServer((request, response) => {
  if (request.url?.startsWith("/latest.yml")) {
    const value = structuredClone(metadata);
    if (badChecksum) {
      const bad = Buffer.alloc(64).toString("base64");
      value.sha512 = bad;
      value.files[0].sha512 = bad;
    }
    response.end(dump(value));
  } else if (request.url?.split("?")[0] === "/" + path.basename(release.installer)) {
    response.writeHead(200, { "Content-Length": metadata.files[0].size });
    createReadStream(release.installer)
      .pipe(
        new Transform({
          transform(chunk, _encoding, callback) {
            setTimeout(() => callback(null, chunk), 1);
          },
        }),
      )
      .pipe(response);
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  for (const corrupt of [false, true]) {
    badChecksum = corrupt;
    const area = path.join(temp, corrupt ? "corrupt" : "good");
    await fs.mkdir(area);
    const adapter = {
      version: "0.1.23",
      name: "LobbyX Test",
      isPackaged: true,
      userDataPath: area,
      baseCachePath: area,
      appUpdateConfigPath: path.join(release.output, "win-unpacked/resources/app-update.yml"),
      whenReady: async () => {},
      onQuit() {
        throw Error("Unexpected automatic install handler");
      },
      quit() {
        throw Error("Unexpected quit");
      },
    };
    const updater = new NsisUpdater(null, adapter);
    updater.httpExecutor = new NodeHttpExecutor();
    // Use the updater's real streaming/checksum/progress implementation with
    // Node's loopback transport, so this test never starts a personal Electron profile.
    updater.httpExecutor.download = ElectronHttpExecutor.prototype.download;
    updater.setFeedURL({ provider: "generic", url: `http://127.0.0.1:${server.address().port}/` });
    updater.disableDifferentialDownload = true;
    updater.quitAndInstall = () => {
      throw Error("Test must never install");
    };
    const states = [];
    let failure;
    updater.on("error", (error) => {
      failure = error;
    });
    const controller = createUpdateController({
      updater,
      version: adapter.version,
      publish: (state) => states.push(state),
    });
    await controller.check();
    if (!corrupt && failure) throw failure;
    assert.equal(controller.snapshot().status, corrupt ? "error" : "ready");
    if (!corrupt) {
      assert.ok(
        states.some(
          (state) => state.status === "downloading" && state.percent > 0 && state.percent < 100,
        ),
        "Real download reports intermediate progress",
      );
      controller.activity(true);
      assert.equal(controller.install().ok, false);
      assert.equal(controller.snapshot().version, release.version);
      console.log(
        `Download real ${adapter.version} → ${release.version}: progresso, checksum, cache e bloqueio em chamada validados.`,
      );
    } else
      console.log("Instalador com checksum incorreto rejeitado; aplicativo continua sem instalar.");
    controller.dispose();
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
  const resolved = path.resolve(temp);
  if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + "lobbyx-update-test-"))
    await fs.rm(resolved, { recursive: true, force: true });
}
