import test from "node:test";
import assert from "node:assert/strict";
import { mentionQueryAt, completeMention, mentionOptions, mentionedUsernames } from "../src/lib/chat-mentions.ts";
const members = [
  { user_id: "1", profile: { username: "nico", display_name: "Nicolas" } },
  { user_id: "2", profile: { username: "ruan", display_name: "Ruan" } },
];
test("Mention completion preserves text after the caret and newline boundaries", () => {
  const content = "Oi\n@ni resto";
  const query = mentionQueryAt(content, 6);
  assert.deepEqual(query, { start: 3, end: 6, query: "ni" });
  assert.deepEqual(completeMention(content, query, "nico"), { content: "Oi\n@nico resto", caret: 8 });
  assert.equal(mentionQueryAt("email@ni", 8), null);
  assert.deepEqual(mentionQueryAt("(@ru", 4), { start: 1, end: 4, query: "ru" });
});
test("Everyone option and names are searchable without a server query", () => {
  assert.equal(mentionOptions(members, "")[0].username, "todos");
  assert.equal(mentionOptions(members, "tod")[0].everyone, true);
  assert.equal(mentionOptions(members, "NI")[0].username, "nico");
  assert.equal(mentionOptions(members, "Ruan")[0].username, "ruan");
  assert.equal(mentionOptions(members, "missing").length, 0);
  assert.ok(mentionOptions(Array.from({ length: 100 }, (_, i) => ({ user_id: `${i}`, profile: { username: `user${i}`, display_name: `User ${i}` } })), "").length <= 6);
});
test("Everyone is an exact mention token, distinct from handles and emails", () => {
  assert.ok(mentionedUsernames("**@TODOS** @nico").has("todos"));
  assert.ok(!mentionedUsernames("email@todos @todos123 @todos_nome").has("todos"));
});
