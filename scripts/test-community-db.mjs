import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Intentionally no remote host, connection URL, environment PGOPTIONS or production helper.
const bin = process.env.PG_BINDIR;
if (!bin) throw Error("Set PG_BINDIR to the local PostgreSQL runtime bin directory.");
const port = "55468",
  database = `lobbyx_community_test_${Date.now()}`;
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))),
  PGHOST: "127.0.0.1",
  PGPASSWORD: "",
  PGCONNECT_TIMEOUT: "5",
};
const args = [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  port,
  "-U",
  "postgres",
  "-w",
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
];
function run(name, options) {
  const r = spawnSync(
    path.join(bin, name + (process.platform === "win32" ? ".exe" : "")),
    options,
    { env, encoding: "utf8", windowsHide: true },
  );
  if (r.status !== 0) throw Error(`${name}: ${r.stderr || r.error?.message}`);
  return r.stdout;
}
const actualDirectory = run("psql", [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  port,
  "-U",
  "postgres",
  "-w",
  "-d",
  "postgres",
  "-At",
  "-c",
  "SHOW data_directory",
]).trim();
const expectedDirectory = path.resolve(process.cwd(), "../communities-pg-data");
if (
  path.resolve(actualDirectory) !== expectedDirectory ||
  !fs.existsSync(path.join(expectedDirectory, "lobbyx-local-test-only.json"))
)
  throw Error("Unrecognized local server; refusing to run fixtures");
run("createdb", ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-w", database]);
run("psql", [...args, "-f", "tests/security-bootstrap.sql"]);
for (const file of fs
  .readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort()) {
  run("psql", [...args, "-f", path.join("supabase/migrations", file)]);
}
run("psql", [...args, "-f", "tests/community-fixture.sql"]);
console.log(run("psql", [...args, "-f", "tests/community-foundation.sql"]));
console.log(run("psql", [...args, "-f", "tests/community-transactions.sql"]));

async function concurrent(sql) {
  return new Promise((resolve) => {
    const child = spawn(
      path.join(bin, "psql" + (process.platform === "win32" ? ".exe" : "")),
      [...args, "-At", "-c", sql],
      { env, windowsHide: true },
    );
    let out = "",
      err = "";
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (err += b));
    child.on("close", (code) => resolve({ code, out, err }));
  });
}
const actor = "BEGIN; SET LOCAL ROLE authenticated; SELECT community_test.actor(1);";
const save =
  "SELECT public.save_server_community(community_test.id('a'),community_test.payload('a'),0); COMMIT;";
const results = await Promise.all([
  concurrent(
    actor +
      "SELECT id FROM public.servers WHERE id=community_test.id('a') FOR UPDATE; SELECT pg_sleep(0.5);" +
      save,
  ),
  concurrent(actor + save),
]);
if (
  results.filter((r) => r.code === 0).length !== 1 ||
  !results.some((r) => /community_revision_conflict/.test(r.err))
)
  throw Error("Concurrent activation failed: " + JSON.stringify(results));
const state = run("psql", [
  ...args,
  "-At",
  "-c",
  "SELECT count(*)=1 AND min(revision)=1 FROM server_community_settings WHERE server_id=community_test.id('a');",
]);
if (!state.includes("t")) throw Error("Concurrent activation duplicated data");
console.log(
  "Concurrent activation: one commit, one explicit revision conflict; no duplicate community.",
);

// Wait for an observed local lock-holder, rather than assuming subprocess startup order.
async function waitForSleeper(name) {
  for (let i = 0; i < 30; i++) {
    const present = run("psql", [
      ...args,
      "-At",
      "-c",
      `SELECT EXISTS(SELECT FROM pg_stat_activity WHERE application_name='${name}' AND wait_event='PgSleep')`,
    ]).trim();
    if (present === "t") return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw Error("Local concurrency barrier not reached");
}
run("psql", [
  ...args,
  "-c",
  actor +
    "SELECT set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),true); COMMIT;",
]);
const revoker = concurrent(
  actor +
    "SET LOCAL application_name='community_revoke'; SELECT set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),false); SELECT pg_sleep(1.5); COMMIT;",
);
await waitForSleeper("community_revoke");
const racedSave = concurrent(
  "BEGIN; SET LOCAL ROLE authenticated; SELECT community_test.actor(2); SELECT save_server_community(community_test.id('a'),community_test.payload('a'),1); COMMIT;",
);
const revoked = await Promise.all([revoker, racedSave]);
if (
  revoked[0].code !== 0 ||
  revoked[1].code === 0 ||
  !revoked[1].err.includes("community_not_authorized")
)
  throw Error("Revocation race failed: " + JSON.stringify(revoked));
console.log(
  "Permission revocation while a save waits: backend rechecks authorization after the lock.",
);
const grantor = concurrent(
  actor +
    "SET LOCAL application_name='community_grant'; SELECT set_community_role_permission(community_test.id('a'),community_test.id('delegate-role'),true); SELECT pg_sleep(1.5); COMMIT;",
);
await waitForSleeper("community_grant");
const racedAssignment = concurrent(
  "BEGIN; SET LOCAL ROLE authenticated; SELECT community_test.actor(4); INSERT INTO member_roles(member_id,role_id) SELECT id,community_test.id('delegate-role') FROM server_members WHERE server_id=community_test.id('a') AND user_id=auth.uid(); COMMIT;",
);
const assigned = await Promise.all([grantor, racedAssignment]);
if (
  assigned[0].code !== 0 ||
  assigned[1].code === 0 ||
  !assigned[1].err.includes("community_owner_required")
)
  throw Error("Concurrent self-assignment failed: " + JSON.stringify(assigned));
console.log("Concurrent grant/self-assignment: owner-only delegation cannot be bypassed.");

// Exercise the inverse lock order: assignment holds the server before an owner grant.
run("psql", [
  ...args,
  "-c",
  `
INSERT INTO roles(id,server_id,name,permissions) VALUES ('c2000000-0000-0000-0000-000000000004',community_test.id('a'),'Race fixture role','{}');
CREATE FUNCTION community_test.pause_assignment() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN IF NEW.role_id='c2000000-0000-0000-0000-000000000004' THEN PERFORM pg_sleep(1.5); END IF; RETURN NEW; END $fn$;
CREATE TRIGGER zz_synthetic_pause_assignment BEFORE INSERT ON member_roles FOR EACH ROW EXECUTE FUNCTION community_test.pause_assignment();`,
]);
const assignmentFirst = concurrent(
  "BEGIN; SET LOCAL ROLE authenticated; SET LOCAL application_name='community_assignment_first'; SELECT community_test.actor(4); INSERT INTO member_roles(member_id,role_id) SELECT id,'c2000000-0000-0000-0000-000000000004' FROM server_members WHERE server_id=community_test.id('a') AND user_id=community_test.user_id(5); COMMIT;",
);
await waitForSleeper("community_assignment_first");
const grantAfter = concurrent(
  actor +
    "SELECT set_community_role_permission(community_test.id('a'),'c2000000-0000-0000-0000-000000000004',true); COMMIT;",
);
const reverseOrder = await Promise.all([assignmentFirst, grantAfter]);
if (reverseOrder.some((r) => r.code !== 0))
  throw Error("Reverse lock order failed: " + JSON.stringify(reverseOrder));
console.log(
  "Assignment before owner grant: serialized successfully without a lock-order deadlock.",
);

// Run prior DB security/notification suites against the complete schema as regressions.
for (const file of [
  "security-write-guards.sql",
  "unread-counts.sql",
  "everyone-mentions.sql",
  "private-permission-invalidations.sql",
  "performance-monitor-access.sql",
]) {
  run("psql", [...args, "-f", "tests/" + file]);
}
console.log(
  `PASS: foundation, RLS, preservation, rate limits, concurrency and prior security suites. Local database retained: ${database}`,
);
