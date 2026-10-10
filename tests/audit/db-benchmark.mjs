import postgres from "postgres";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const baseline = process.argv[3] === "--baseline-v1";
const previous =
  process.argv[3] && !baseline ? JSON.parse(await readFile(process.argv[3], "utf8")) : null;
const database = previous?.database ?? `lobbyx_audit_${Date.now()}`;
if (!/^lobbyx_audit_\d+$/.test(database))
  throw Error("Only isolated local audit fixtures accepted");
const options = {
  host: "127.0.0.1",
  port: 55448,
  username: "postgres",
  password: "",
  ssl: false,
  onnotice() {},
};
if (!previous) {
  const admin = postgres({ ...options, database: "postgres", max: 1 });
  await admin.unsafe(`CREATE DATABASE ${database}`);
  await admin.end();
  const seed = postgres({ ...options, database, max: 1 });
  await seed.unsafe(await readFile("tests/security-bootstrap.sql", "utf8"));
  for (const file of (await readdir("supabase/migrations"))
    .filter(
      (x) =>
        x.endsWith(".sql") && !(baseline && x === "20261010020000_unread_query_performance.sql"),
    )
    .sort())
    await seed.unsafe(await readFile(`supabase/migrations/${file}`, "utf8"));
  const uid = (i) => `90000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
  const room = "91000000-0000-0000-0000-000000000001";
  for (let i = 1; i <= 100; i++)
    await seed`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES (${uid(i)},${`audit${i}@example.test`},${seed.json({ username: `audit${i}`, display_name: `Audit ${i}` })})`;
  await seed`INSERT INTO servers(id,owner_id,name) VALUES (${room},${uid(1)},'Local audit')`;
  for (let i = 1; i <= 100; i++)
    await seed`INSERT INTO server_members(server_id,user_id,joined_at) VALUES (${room},${uid(i)},now()-interval '2 hours')`;
  for (let i = 1; i <= 10; i++)
    await seed`INSERT INTO channels(id,server_id,name,type) VALUES (${`92000000-0000-0000-0000-${String(i).padStart(12, "0")}`},${room},${`channel-${i}`},'text')`;
  await seed.unsafe(
    `INSERT INTO messages(channel_id,author_id,content,created_at) SELECT ('92000000-0000-0000-0000-'||lpad(((g-1)%10+1)::text,12,'0'))::uuid,('90000000-0000-0000-0000-'||lpad(((g-1)%100+1)::text,12,'0'))::uuid,'Synthetic message '||g,now()-interval '1 hour'+g*interval '0.1 seconds' FROM generate_series(1,10000) g`,
  );
  await seed.unsafe("ANALYZE");
  await seed.end();
} else {
  const migration = postgres({ ...options, database, max: 1 });
  await migration.unsafe(
    await readFile("supabase/migrations/20261010020000_unread_query_performance.sql", "utf8"),
  );
  await migration.unsafe("ANALYZE");
  await migration.end();
}
const uid = (i) => `90000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
const room = "91000000-0000-0000-0000-000000000001";
const sql = postgres({ ...options, database, max: 100, idle_timeout: 5, connect_timeout: 10 });
const data = {
  scope:
    "Local PostgreSQL schema/RLS with synthetic data; no Supabase HTTP/Realtime or remote services",
  database,
  users: 100,
  messages: 10000,
  channels: 10,
  measurements: [],
  plans: {},
};
const channel = "92000000-0000-0000-0000-000000000001";
const queries = {
  history30: `SELECT * FROM public.messages WHERE channel_id='${channel}' ORDER BY created_at DESC LIMIT 30`,
  unread: "SELECT * FROM public.get_server_unread_counts()",
  members: `SELECT * FROM public.server_members WHERE server_id='${room}' ORDER BY joined_at`,
};
for (const [operation, query] of Object.entries(queries)) {
  const times = [];
  for (let i = 0; i < 32; i++) {
    const result = await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL ROLE authenticated");
      await tx`SELECT set_config('request.jwt.claim.sub',${uid(2)},true)`;
      const plan = await tx.unsafe(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${query}`);
      return plan[0]["QUERY PLAN"][0];
    });
    if (i >= 2) times.push(result["Execution Time"]);
    data.plans[operation] = result;
  }
  data.measurements.push({ operation, scenario: "warm SQL execution only", samplesMs: times });
}
for (const users of [10, 50, 100]) {
  const samplesMs = [],
    errors = [];
  for (let batch = 0; batch < 3; batch++) {
    await Promise.all(
      Array.from({ length: users }, async (_, i) => {
        const before = performance.now();
        try {
          await sql.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE authenticated");
            await tx`SELECT set_config('request.jwt.claim.sub',${uid(i + 1)},true)`;
            await tx.unsafe(queries.unread);
          });
          samplesMs.push(performance.now() - before);
        } catch (error) {
          errors.push({ code: error.code, message: error.message });
        }
      }),
    );
  }
  data.measurements.push({ operation: "unread-concurrent", users, samplesMs, errors });
}
await sql.end();
await writeFile(process.argv[2], JSON.stringify(data, null, 2));
console.log(
  JSON.stringify({
    database,
    measurements: data.measurements.map((r) => ({
      operation: r.operation,
      users: r.users,
      samples: r.samplesMs.length,
      errors: r.errors?.length ?? 0,
    })),
  }),
);
