import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import fs from "node:fs";
const source = fs.readFileSync(
  new URL("../src/lib/community-experience.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const {
  DEFAULT_EXPERIENCE,
  validateExperience,
  selectableCommunityRole,
  onboardingNeeded,
  parseExperience,
} = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
test("community personalization preserves defaults and rejects unsafe text, URLs, duplicates and modules", () => {
  const value = validateExperience(DEFAULT_EXPERIENCE);
  assert.deepEqual(value, DEFAULT_EXPERIENCE);
  assert.notEqual(value, DEFAULT_EXPERIENCE);
  for (const patch of [
    { banner_url: "javascript:alert(1)" },
    { banner_url: "https://name:secret@example.test/x" },
    { modules: ["events", "events"] },
    { rules_required: true, rules_enabled: false },
    { intro: "bad" + String.fromCharCode(1) },
    { featured_channels: ["bad"] },
    { notices: [{ id: "bad", title: "", body: "x" }] },
  ])
    assert.throws(() => validateExperience({ ...value, ...patch }));
});
test("onboarding excludes all known and unknown privileged role grants", () => {
  const role = { name: "Coop", permissions: { view_channel: true } };
  assert.equal(selectableCommunityRole(role), true);
  for (const key of [
    "administrator",
    "manage_community",
    "manage_members",
    "manage_roles",
    "manage_server",
    "kick_members",
    "ban_members",
    "manage_voice",
    "create_invite",
    "future_permission",
  ])
    assert.equal(selectableCommunityRole({ ...role, permissions: { [key]: true } }), false, key);
  for (const name of ["OWNER", "ADMIN", "MEMBER"])
    assert.equal(selectableCommunityRole({ ...role, name }), false);
});
test("experience identity and completion are scoped to server and both revisions", () => {
  const data = {
    server_id: "server-a",
    revision: 2,
    rules_revision: 3,
    experience: { ...DEFAULT_EXPERIENCE, rules_required: true },
    rules: [],
    interests: [],
    progress: null,
    screened: true,
    can_manage: false,
  };
  assert.equal(onboardingNeeded(data), true);
  assert.throws(() => parseExperience(data, "server-b"));
  assert.equal(parseExperience(data, "server-a").server_id, "server-a");
  assert.equal(
    onboardingNeeded({ ...data, progress: { completed_revision: 2, accepted_revision: 2 } }),
    true,
  );
  assert.equal(
    onboardingNeeded({ ...data, progress: { completed_revision: 2, accepted_revision: 3 } }),
    false,
  );
  assert.equal(
    onboardingNeeded({ ...data, progress: { completed_revision: 1, accepted_revision: 3 } }),
    true,
  );
});
