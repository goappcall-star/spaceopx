import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/community-discovery.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const {
  validateDiscoveryPayload,
  parsePublicCommunity,
  parseDiscoveryPage,
  parsePresentation,
  parseDiscoverySettings,
  parseJoinRequests,
} = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const payload = {
  name: "Squad local",
  description: "Descrição sintética de uma comunidade local.",
  icon_url: null,
  banner_url: null,
  category: "gaming",
  language: "pt-br",
  interests: ["Coop"],
  public_rules: ["Respeito."],
  admission: "approval",
  consent: false,
};
const card = {
  ...payload,
  server_id: "cd000000-0000-0000-0000-000000000001",
  published_at: "2030-01-01T00:00:00Z",
  featured: false,
};
test("discovery validates explicit public payload and secure images", () => {
  assert.equal(validateDiscoveryPayload(payload).consent, false);
  assert.deepEqual(validateDiscoveryPayload(payload).interests, ["coop"]);
  for (const patch of [
    { icon_url: "https://user:pass@example.test/x" },
    { banner_url: "javascript:alert(1)" },
    { language: "p<script>" },
    { category: "secret" },
    { description: "short" },
    { public_rules: Array(11).fill("r") },
    { admission: "admin" },
    { interests: [42] },
  ])
    assert.throws(() => validateDiscoveryPayload({ ...payload, ...patch }));
});
test("public projection never forwards private metadata or invents member counts", () => {
  const result = parsePublicCommunity({
    ...card,
    owner_id: "private",
    channels: ["secret"],
    members: 500,
  });
  assert.equal(result.name, card.name);
  for (const key of ["consent", "owner_id", "channels", "members"])
    assert.equal(key in result, false);
  assert.equal(parseDiscoveryPage({ items: [card], has_more: false }).items.length, 1);
  assert.throws(() => parseDiscoveryPage({ items: Array(31).fill(card), has_more: true }));
  assert.throws(() => parsePublicCommunity({ ...card, server_id: "bad" }));
});
test("discovery contracts reject malformed requests, revisions and owner capability", () => {
  assert.equal(parsePresentation(null), null);
  assert.equal(
    parsePresentation({
      ...card,
      revision: 2,
      my_membership: false,
      can_join: true,
      my_request: { status: "pending", revision: 1 },
    }).my_request.status,
    "pending",
  );
  for (const patch of [
    { revision: 0 },
    { my_membership: "yes" },
    { my_request: { status: "owner", revision: 1 } },
  ])
    assert.throws(() =>
      parsePresentation({
        ...card,
        revision: 2,
        my_membership: false,
        can_join: true,
        my_request: null,
        ...patch,
      }),
    );
  assert.throws(() => parseDiscoverySettings({ is_owner: 1, listing: null }));
  assert.throws(() => parseJoinRequests({ items: [{ user_id: "bad" }], has_more: false }));
});
