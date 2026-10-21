import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";
const code = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/community-events.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const {
  eventTimeChoices,
  eventLocalInput,
  validateEventPayload,
  parseEventPage,
  parseEventNotifications,
} = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const payload = {
  title: "Encontro",
  description: "Jogar juntos",
  cover_url: null,
  channel_id: "ca000000-0000-0000-0000-000000000001",
  starts_at: "2030-06-21T23:00:00Z",
  ends_at: null,
  timezone: "America/Sao_Paulo",
};
test("event wall-clock conversion preserves timezone rather than machine timezone", () => {
  assert.deepEqual(eventTimeChoices("2030-06-21T20:00", "America/Sao_Paulo"), [
    "2030-06-21T23:00:00.000Z",
  ]);
  assert.equal(eventLocalInput(payload.starts_at, payload.timezone), "2030-06-21T20:00");
});
test("DST gaps and folds cannot silently select a different event instant", () => {
  assert.deepEqual(eventTimeChoices("2026-03-08T02:30", "America/New_York"), []);
  assert.deepEqual(eventTimeChoices("2026-11-01T01:30", "America/New_York"), [
    "2026-11-01T05:30:00.000Z",
    "2026-11-01T06:30:00.000Z",
  ]);
  assert.throws(() => eventTimeChoices("2026-02-30T12:00", "UTC"));
  assert.throws(() => eventTimeChoices("2026-01-01T12:00", "Unknown/Zone"));
});
test("event payload rejects dangerous covers, invalid durations and unbounded text", () => {
  assert.deepEqual(validateEventPayload(payload), payload);
  for (const patch of [
    { cover_url: "javascript:alert(1)" },
    { cover_url: "https://name:secret@example.test/x" },
    { ends_at: "2030-06-21T22:59:00Z" },
    { starts_at: "2030-06-21T23:00:00" },
    { title: " " },
    { description: "x".repeat(4001) },
    { channel_id: "bad" },
    { timezone: "Unknown/Zone" },
  ])
    assert.throws(() => validateEventPayload({ ...payload, ...patch }));
});
test("event response rejects cross-server rows, invented counters and malformed notifications", () => {
  const sid = "ca000000-0000-0000-0000-000000000002",
    e = {
      ...payload,
      id: "ce000000-0000-0000-0000-000000000001",
      server_id: sid,
      status: "scheduled",
      revision: 1,
      created_at: "2026-10-21T00:00:00Z",
      updated_at: "2026-10-21T00:00:00Z",
      my_response: "none",
      my_notify: false,
      interested_count: 0,
      going_count: 0,
    };
  assert.equal(
    parseEventPage({ items: [e], has_more: false, can_manage: false }, sid).items.length,
    1,
  );
  assert.throws(() =>
    parseEventPage({ items: [{ ...e, going_count: -1 }], has_more: false, can_manage: false }, sid),
  );
  assert.throws(() => parseEventPage({ items: [e], has_more: false, can_manage: false }, e.id));
  assert.throws(() => parseEventNotifications([{ id: "bad" }]));
});
