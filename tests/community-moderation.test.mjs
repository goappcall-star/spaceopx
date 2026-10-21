import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(
  fs.readFileSync(new URL("../src/lib/community-moderation.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const {
  parseModerationAccess,
  parseReport,
  parseModerationPage,
  parsePlatformDirectory,
  validateSecurity,
  moderationError,
} = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
const id = "cc000000-0000-0000-0000-000000000001",
  time = "2030-01-01T00:00:00Z";
test("moderation access requires real booleans and allowlisted explicit capabilities", () => {
  assert.deepEqual(parseModerationAccess({ platform: false, owner: false, capabilities: [] }), {
    platform: false,
    owner: false,
    capabilities: [],
  });
  for (const input of [
    { platform: "true", owner: false, capabilities: [] },
    { platform: true, owner: false, capabilities: ["administrator"] },
  ])
    assert.throws(() => parseModerationAccess(input));
});
test("report projection never forwards reporter identity or arbitrary private metadata", () => {
  const r = parseReport({
    id,
    server_id: id,
    kind: "message",
    target_id: id,
    category: "spam",
    status: "pending",
    revision: 1,
    description: null,
    evidence: null,
    evidence_until: time,
    reviewed_by: null,
    created_at: time,
    decisions: [],
    reporter_id: "secret",
    owner_email: "secret",
  });
  assert.equal("reporter_id" in r, false);
  assert.equal("owner_email" in r, false);
  assert.throws(() =>
    parseModerationPage({ items: Array(31).fill(r), has_more: false }, parseReport),
  );
  assert.throws(() => parseReport({ ...r, revision: 0 }));
  assert.equal(parseModerationPage({ items: [r], has_more: false }, parseReport).items.length, 1);
});
test("security configuration rejects arbitrary patterns, URLs and unsafe limits", () => {
  const base = {
    revision: 0,
    enabled: false,
    burst_limit: 8,
    repeat_limit: 3,
    mentions_limit: 8,
    blocked_domains: ["example.test"],
  };
  assert.equal(validateSecurity(base).enabled, false);
  for (const patch of [
    { burst_limit: 0 },
    { repeat_limit: 1 },
    { mentions_limit: 100 },
    { blocked_domains: ["https://example.test/path"] },
    { blocked_domains: [".*"] },
    { blocked_domains: Array(51).fill("x.test") },
    { enabled: "yes" },
  ])
    assert.throws(() => validateSecurity({ ...base, ...patch }));
  assert.deepEqual(
    validateSecurity({ ...base, blocked_domains: ["EXAMPLE.TEST", "example.test"] })
      .blocked_domains,
    ["example.test"],
  );
});
test("platform directory contracts expose only public presentation and moderation states", () => {
  const r = parsePlatformDirectory({
    server_id: id,
    revision: 2,
    status: "suspended",
    featured: false,
    presentation: {
      name: "Public squad",
      description: "Public text",
      private_messages: ["secret"],
    },
    owner_id: "private",
  });
  assert.equal("owner_id" in r, false);
  assert.equal("private_messages" in r.presentation, false);
  assert.equal(parsePlatformDirectory(null), null);
  assert.throws(() => parsePlatformDirectory({ ...r, status: "admin" }));
  assert.match(moderationError(Error("community_spam_rate")), /texto foi mantido/);
  assert.match(moderationError(Error("moderation_independent_review_required")), /outra pessoa/);
});
