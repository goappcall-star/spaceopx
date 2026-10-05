import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { load } = require("js-yaml");
export async function verifyDesktopRelease(root = process.cwd()) {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "desktop/package.json"), "utf8"));
  const config = JSON.parse(await fs.readFile(path.join(root, "electron-builder.json"), "utf8"));
  const output = path.resolve(root, config.directories.output);
  const metadata = load(await fs.readFile(path.join(output, "latest.yml"), "utf8"));
  const filename = `LobbyX-Setup-${manifest.version}-x64.exe`;
  const entry = metadata.files?.find((file) => file.url === filename);
  if (metadata.version !== manifest.version || metadata.path !== filename || !entry)
    throw Error("Metadados não correspondem à versão do instalador.");
  const installer = path.join(output, filename),
    blockmap = installer + ".blockmap";
  const bytes = await fs.readFile(installer);
  const sha512 = createHash("sha512").update(bytes).digest("base64");
  if (entry.sha512 !== sha512 || metadata.sha512 !== sha512 || entry.size !== bytes.length)
    throw Error("Checksum/tamanho do instalador não corresponde ao latest.yml.");
  if ((await fs.stat(blockmap)).size === 0) throw Error("Blockmap vazio.");
  const feed = await fs.readFile(
    path.join(output, "win-unpacked/resources/app-update.yml"),
    "utf8",
  );
  if (
    !feed.includes("provider: github") ||
    !feed.includes("repo: spaceopx") ||
    !feed.includes("owner: goappcall-star")
  )
    throw Error("Feed de atualização incorreto.");
  const asar = require("@electron/asar");
  const archive = path.join(output, "win-unpacked/resources/app.asar");
  const packed = JSON.parse(asar.extractFile(archive, "package.json").toString());
  if (packed.version !== manifest.version) throw Error("Versão empacotada incorreta.");
  asar.extractFile(archive, path.join("node_modules", "electron-updater", "out", "main.js"));
  asar.extractFile(archive, "updater.cjs");
  return {
    version: manifest.version,
    output,
    installer,
    blockmap,
    metadata: path.join(output, "latest.yml"),
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await verifyDesktopRelease();
  console.log(
    `Release ${result.version} validada: instalador, blockmap, latest.yml e atualizador empacotado.`,
  );
}
