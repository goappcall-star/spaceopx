import postgres from "postgres";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
const previous = JSON.parse(await readFile(process.argv[2], "utf8"));
if (!/^lobbyx_audit_\d+$/.test(previous.database))
  throw Error("Only local audit fixtures accepted");
const sql = postgres({
  host: "127.0.0.1",
  port: 55448,
  username: "postgres",
  password: "",
  database: previous.database,
  ssl: false,
  max: 50,
  onnotice() {},
});
const uid = (i) => `90000000-0000-0000-0000-${String(i).padStart(12, "0")}`;
const source = await readFile(
  "supabase/migrations/20261010010000_persistent_unread_badges.sql",
  "utf8",
);
const underlying = source.match(/AS \$\$\s*(SELECT[\s\S]*?)\s*\$\$/i)[1];
const output = {
  scope: "Diagnostic comparison in local synthetic database only, unchanged queries and policies",
  database: previous.database,
  plans: {},
  samples: [],
};
for (const role of ["authenticated", "postgres"]) {
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const p = await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL ROLE ${role}`);
      await tx`SELECT set_config('request.jwt.claim.sub',${uid(2)},true)`;
      const data = await tx.unsafe(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${underlying}`);
      return data[0]["QUERY PLAN"][0];
    });
    rows.push(p["Execution Time"]);
    output.plans[role] = p;
  }
  output.samples.push({ operation: "underlying-unread", role, samplesMs: rows });
}
await sql.begin(async (tx) => {
  await tx.unsafe("SET LOCAL ROLE authenticated");
  await tx`SELECT set_config('request.jwt.claim.sub',${uid(2)},true)`;
  await tx.unsafe("SELECT public.mark_channel_read_through(id,NULL) FROM public.channels");
});
const caughtUp = [];
for (let i = 0; i < 30; i++) {
  const p = await sql.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub',${uid(2)},true)`;
    return (
      await tx.unsafe(
        "EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT * FROM public.get_server_unread_counts()",
      )
    )[0]["QUERY PLAN"][0];
  });
  caughtUp.push(p["Execution Time"]);
}
output.samples.push({ operation: "unread-caught-up", samplesMs: caughtUp });
for (const users of [10, 50, 100]) {
  const samplesMs = [],
    errors = [];
  for (let batch = 0; batch < 2; batch++)
    await Promise.all(
      Array.from({ length: users }, async (_, i) => {
        const before = performance.now();
        try {
          await sql.begin(async (tx) => {
            await tx.unsafe("SET LOCAL ROLE authenticated");
            await tx`SELECT set_config('request.jwt.claim.sub',${uid(i + 1)},true)`;
            await tx`INSERT INTO public.messages(channel_id,author_id,content,mentions) VALUES ('92000000-0000-0000-0000-000000000001',${uid(i + 1)},'Concurrent synthetic message',ARRAY[${uid(2)}]::uuid[])`;
          });
          samplesMs.push(performance.now() - before);
        } catch (error) {
          errors.push({ code: error.code, message: error.message });
        }
      }),
    );
  output.samples.push({
    operation: "concurrent-insert-mention",
    users,
    poolMax: 50,
    samplesMs,
    errors,
  });
}
await sql.end();
await writeFile(process.argv[3], JSON.stringify(output, null, 2));
console.log("Local follow-up saved");
