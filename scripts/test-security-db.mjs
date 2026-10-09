import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

// Never accepts a connection string or remote host. Creates only a fresh local fixture.
const bin = process.env.PG_BINDIR;
if (!bin) throw new Error("Set PG_BINDIR to the local PostgreSQL bin directory.");
const port = process.env.LOBBYX_TEST_PG_PORT ?? "55448";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid local test port.");
const database = `lobbyx_security_test_${Date.now()}`;
const run = (program, args) => {
  const result = spawnSync(
    path.join(bin, program + (process.platform === "win32" ? ".exe" : "")),
    ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-w", ...args],
    {
      encoding: "utf8",
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([name]) => !name.startsWith("PG")),
        ),
        PGPASSWORD: "",
        PGHOST: "127.0.0.1",
      },
    },
  );
  if (result.status !== 0)
    throw new Error(`${program} failed: ${result.stderr || result.error?.message}`);
};
run("createdb", [database]);
console.log(`Isolated local fixture: ${database}`);
run("psql", ["-d", database, "-v", "ON_ERROR_STOP=1", "-f", "tests/security-bootstrap.sql"]);
for (const file of readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  run("psql", [
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    path.join("supabase/migrations", file),
  ]);
}
run("psql", ["-d", database, "-v", "ON_ERROR_STOP=1", "-f", "tests/security-write-guards.sql"]);
console.log("Security migration, RLS isolation, write limits and normal workflows: PASS");
