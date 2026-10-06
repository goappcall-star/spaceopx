import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
import test from "node:test";
import assert from "node:assert/strict";
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL("../src/" + file, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (name) => imports[name] },
  );
  return exports;
}
const { mentionedUsernames, canNotifyMention } = load("lib/chat-mentions.ts");
const { shouldApplyVoiceMove } = load("services/voice-moderation.ts", {
  "@/integrations/supabase/client": {},
});
test("Mention tokens match complete handles, not email addresses or username prefixes", () => {
  assert.deepEqual(Array.from(mentionedUsernames("Oi @Nico @nicolas! (@ana) @nico foo@nico.com")), [
    "nico",
    "nicolas",
    "ana",
  ]);
  assert.equal(mentionedUsernames("@nicolas").has("nico"), false);
});
test("DND and offline suppress live mentions; online and away receive them", () => {
  for (const s of ["dnd", "offline", "invisible"]) assert.equal(canNotifyMention(s), false);
  for (const s of ["online", "idle"]) assert.equal(canNotifyMention(s), true);
});
test("Voice move requests must match the current user, server, room and session and expire", () => {
  const now = Date.now();
  const r = {
    recipient_id: "me",
    server_id: "s",
    source_channel_id: "a",
    destination_channel_id: "b",
    voice_session_id: "session",
    created_at: new Date(now).toISOString(),
  };
  const apply = (row) => shouldApplyVoiceMove(row, "me", "s", "a", "session", now);
  assert.equal(apply(r), true);
  for (const field of ["recipient_id", "server_id", "source_channel_id", "voice_session_id"])
    assert.equal(apply({ ...r, [field]: "other" }), false);
  assert.equal(apply({ ...r, created_at: new Date(now - 15000).toISOString() }), false);
  assert.equal(apply({ ...r, created_at: "invalid" }), false);
  assert.equal(apply({ ...r, created_at: new Date(now + 6000).toISOString() }), false);
});
