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
  return result.stdout;
};
run("createdb", [database]);
console.log(`Isolated local fixture: ${database}`);
run("psql", ["-d", database, "-v", "ON_ERROR_STOP=1", "-f", "tests/security-bootstrap.sql"]);
for (const file of readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  const publicationQuery = [
    "-d",
    database,
    "-At",
    "-c",
    "SELECT schemaname || '.' || tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY 1",
  ];
  const before = file.includes("private_permission_invalidations")
    ? run("psql", publicationQuery).trim().split(/\r?\n/).filter(Boolean)
    : null;
  run("psql", [
    "-d",
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    path.join("supabase/migrations", file),
  ]);
  if (before) {
    const after = run("psql", publicationQuery).trim().split(/\r?\n/).filter(Boolean);
    if (
      JSON.stringify(after) !==
      JSON.stringify([...before, "public.permission_invalidations"].sort())
    ) {
      throw new Error("Realtime correction changed an existing publication member");
    }
  }
}
run("psql", ["-d", database, "-v", "ON_ERROR_STOP=1", "-f", "tests/security-write-guards.sql"]);
run("psql", ["-d", database, "-v", "ON_ERROR_STOP=1", "-f", "tests/unread-counts.sql"]);
run("psql", [
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  "tests/private-permission-invalidations.sql",
]);
run("psql", [
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  "tests/performance-monitor-access.sql",
]);
console.log("Security migration, RLS isolation, write limits and normal workflows: PASS");
