import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (id) => {
        if (!(id in dependencies)) throw Error(id);
        return dependencies[id];
      },
    },
  );
  return exports;
}
const cosmetics = load("../src/lib/profile-cosmetics.ts");
test("Unknown and missing decorations safely render as undecorated profiles", () => {
  for (const input of [undefined, null, "", "invalid", "<script>", {}]) {
    assert.equal(cosmetics.normalizeProfileCosmetic(input), "none");
    assert.equal(Object.keys(cosmetics.nameplateStyle(input)).length, 0);
  }
});
test("Cosmetics are saved through the shared profile service with account scope and whitelist", async () => {
  let table, account, payload;
  const request = {
    update(value) {
      payload = value;
      return this;
    },
    eq(column, value) {
      assert.equal(column, "id");
      account = value;
      return this;
    },
    select() {
      return this;
    },
    async single() {
      return { data: { id: account, ...payload }, error: null };
    },
  };
  const { profilesService } = load("../src/services/profiles.ts", {
    "@/integrations/supabase/client": {
      supabase: {
        from(value) {
          table = value;
          return request;
        },
      },
    },
    "@/lib/profile-cosmetics": cosmetics,
    "@/lib/avatar-frames": { normalizeAvatarFrame: (value) => value },
    "@/lib/profile-status": { validateProfileStatus() {} },
  });
  const result = await profilesService.update("viewer-account", {
    nameplate: "cosmic",
    profile_frame: "sakura",
    username: "should-not-change",
  });
  assert.equal(table, "profiles");
  assert.equal(account, "viewer-account");
  assert.equal(result.nameplate, "cosmic");
  assert.equal(result.profile_frame, "sakura");
  assert.equal("username" in payload, false);
  await profilesService.update("viewer-account", { nameplate: "invalid" });
  assert.equal(payload.nameplate, "none");
});
