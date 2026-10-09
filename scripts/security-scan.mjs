import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  if (result.status !== 0) throw new Error("Security scan could not read Git metadata.");
  return result.stdout;
}
const findings = new Map();
let checked = 0;
function inspect(text, file) {
  checked++;
  const kinds = new Set();
  if (/\bsb_secret_[A-Za-z0-9_-]{24,}/.test(text)) kinds.add("Supabase secret key");
  if (/\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{70,})/.test(text))
    kinds.add("GitHub access token");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))
    kinds.add("Private signing key");
  if (/postgres(?:ql)?:\/\/[^\s/:'"<>]+:[^\s/@'"<>]+@/i.test(text))
    kinds.add("Database URL with password");
  for (const match of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], "base64url").toString()).role === "service_role")
        kinds.add("Privileged Supabase JWT");
    } catch {
      /* not a JWT */
    }
  }
  for (const kind of kinds) findings.set(`${file}:${kind}`, { file, kind });
}
for (const file of git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"])
  .split("\0")
  .filter(Boolean)) {
  if (!existsSync(file) || !statSync(file).isFile()) continue;
  const buffer = readFileSync(file);
  if (buffer.length > 5 * 1024 * 1024 || buffer.subarray(0, 8192).includes(0)) continue;
  inspect(buffer.toString("utf8"), file);
}
if (process.argv.includes("--history")) {
  let file = "Git history";
  for (const line of git(["log", "--all", "-p", "--no-ext-diff", "--unified=0"]).split("\n")) {
    if (line.startsWith("+++ b/")) file = `history:${line.slice(6)}`;
    if (line.startsWith("+") && !line.startsWith("+++")) inspect(line.slice(1), file);
  }
}
if (process.argv.includes("--assets")) {
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) walk(file);
      else if (/\.(?:js|mjs|cjs|json|html|css|map|txt)$/i.test(file))
        inspect(readFileSync(file, "utf8"), file);
    }
  };
  walk("desktop/web");
  walk(".output/public");
}
// Report only the path and class, never matching text or credential values.
console.log(JSON.stringify({ checked, findings: [...findings.values()] }, null, 2));
if (findings.size) process.exitCode = 1;
