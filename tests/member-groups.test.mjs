import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(new URL("../src/lib/member-groups.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText,
  { exports },
);
test("Members appear once under their highest role, matching role configuration order", () => {
  const low = { id: "member", position: 1 },
    high = { id: "admin", position: 50 },
    owner = { id: "owner", position: 100 };
  const members = [
    { id: "a", roles: [low, high], profile: { display_name: "Ana" } },
    { id: "b", roles: [owner], profile: { display_name: "Beto" } },
    { id: "c", roles: [], profile: { display_name: "Cris" } },
    { id: "d", roles: [low], nickname: "Dani" },
  ];
  const groups = exports.groupMembersByRole(members);
  assert.deepEqual(
    Array.from(groups, (g) => g.role?.id ?? "unassigned"),
    ["owner", "admin", "member", "unassigned"],
  );
  assert.equal(groups.flatMap((g) => g.members).length, 4);
  assert.equal(groups[1].members[0].id, "a");
  assert.deepEqual(members[0].roles, [low, high], "original role list remains unchanged");
  high.position = 150;
  assert.equal(
    exports.groupMembersByRole(members)[0].role.id,
    "admin",
    "new role position takes effect",
  );
});
test("Private aliases are isolated between accounts and target users", () => {
  assert.notEqual(exports.memberAliasKey("one", "target"), exports.memberAliasKey("two", "target"));
  assert.notEqual(exports.memberAliasKey("one", "target"), exports.memberAliasKey("one", "other"));
});
