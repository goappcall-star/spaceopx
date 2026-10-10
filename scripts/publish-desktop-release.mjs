import { verifyDesktopRelease } from "./verify-desktop-release.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
const release = await verifyDesktopRelease();
// Default is draft only. Promotion requires an explicit operator action after
// WEB + installer validation; never add this flag to unattended CI.
const publishApproved = process.argv.slice(2).includes("--publish-approved");
if (process.argv.slice(2).some((arg) => arg !== "--publish-approved"))
  throw Error("Unknown release argument");
const repo = "goappcall-star/spaceopx",
  tag = `v${release.version}`;
const run = (args) => execFileSync("gh", args, { stdio: "inherit", windowsHide: true });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
try {
  execFileSync("gh", ["release", "view", tag, "--repo", repo], {
    stdio: "ignore",
    windowsHide: true,
  });
  throw Error("Essa release já existe. Incremente a versão antes de publicar.");
} catch (error) {
  if (!error.status) throw error;
}
// Keep the landing page's stable download URL alongside versioned update assets.
const stable = path.join(release.output, "LobbyX-Setup-x64.exe");
await fs.copyFile(release.installer, stable);
run([
  "release",
  "create",
  tag,
  release.installer,
  release.blockmap,
  release.metadata,
  stable,
  "--repo",
  repo,
  "--draft",
  "--target",
  sha,
  "--title",
  `LobbyX ${release.version}`,
  "--generate-notes",
]);
// All assets are uploaded while private to the draft; never expose half a release.
if (publishApproved) run(["release", "edit", tag, "--repo", repo, "--draft=false", "--latest"]);
else
  console.log(
    "Draft prepared. Auto-update feed unchanged; publication requires explicit approval.",
  );
