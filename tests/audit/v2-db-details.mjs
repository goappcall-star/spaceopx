import postgres from "postgres";
import { readFile, writeFile } from "node:fs/promises";
const data = JSON.parse(await readFile(process.argv[2], "utf8"));
if (!/^lobbyx_audit_\d+$/.test(data.database)) throw Error("Only local audit fixtures accepted");
const sql = postgres({
  host: "127.0.0.1",
  port: 55448,
  username: "postgres",
  password: "",
  database: data.database,
  max: 1,
  ssl: false,
  onnotice() {},
});
const actor = "90000000-0000-0000-0000-000000000002";
const source = await readFile(
  "supabase/migrations/20261010020000_unread_query_performance.sql",
  "utf8",
);
const body = source
  .split("CREATE OR REPLACE FUNCTION public.get_server_unread_counts()")[1]
  .match(/AS \$\$([\s\S]*?)\$\$/)[1];
const report = {
  scope: "Local paired fixture, V2 range plan and read-through only",
  samplesMs: [],
  database: data.database,
};
report.unreadPlan = await sql.begin(async (tx) => {
  await tx.unsafe("SET LOCAL ROLE authenticated");
  await tx`SELECT set_config('request.jwt.claim.sub',${actor},true)`;
  return (await tx.unsafe(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${body}`))[0]["QUERY PLAN"][0];
});
await sql.begin(async (tx) => {
  await tx.unsafe("SET LOCAL ROLE authenticated");
  await tx`SELECT set_config('request.jwt.claim.sub',${actor},true)`;
  await tx.unsafe("SELECT public.mark_channel_read_through(id,NULL) FROM public.channels");
});
for (let i = 0; i < 32; i++) {
  const plan = await sql.begin(async (tx) => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub',${actor},true)`;
    return (await tx.unsafe(`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) ${body}`))[0]["QUERY PLAN"][0];
  });
  if (i >= 2) report.samplesMs.push(plan["Execution Time"]);
  report.caughtUpPlan = plan;
}
await sql.end();
await writeFile(process.argv[3], JSON.stringify(report, null, 2));
