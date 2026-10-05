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
const themes = load("../src/lib/anime-frame-themes.ts");
const cosmetics = load("../src/lib/profile-cosmetics.ts", { "./anime-frame-themes": themes });
test("Original themes also work on avatars while preserving the existing frames", () => {
  const avatars = load("../src/lib/avatar-frames.ts", { "./anime-frame-themes": themes });
  for (const theme of themes.ANIME_FRAME_THEMES) {
    assert.equal(cosmetics.normalizeProfileCosmetic(theme.id), theme.id);
    assert.equal(avatars.normalizeAvatarFrame(theme.id), theme.id);
  }
  for (const id of ["default", "neon", "orbit", "royal"])
    assert.equal(avatars.normalizeAvatarFrame(id), id);
});
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
  for (const theme of themes.ANIME_FRAME_THEMES) {
    await profilesService.update("viewer-account", { profile_frame: theme.id });
    assert.equal(payload.profile_frame, theme.id);
  }
  await profilesService.update("viewer-account", { nameplate: "crimson-flow" });
  assert.equal(
    payload.nameplate,
    "none",
    "frame-only designs are not written as unsupported nameplates",
  );
  await profilesService.update("viewer-account", { nameplate: "invalid" });
  assert.equal(payload.nameplate, "none");
});
