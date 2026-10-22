import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(url) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports, require: (relative) => load(new URL(relative + ".ts", url)) },
  );
  return exports;
}
const api = load(new URL("../src/lib/profile-editor.ts", import.meta.url));
const image = load(new URL("../src/lib/profile-image.ts", import.meta.url));
test("Profile edits preserve presence and username by excluding them from the update", () => {
  const source = {
    display_name: "Nico",
    username: "nico",
    status: "dnd",
    custom_status: "Em uma partida",
    avatar_frame: "royal",
  };
  const draft = api.profileDraft(source, false);
  const update = api.profileDraftUpdate({ ...draft, display_name: " Novo nome " });
  assert.equal(update.display_name, "Novo nome");
  for (const key of ["username", "status", "custom_status", "frame_animations_enabled"])
    assert.equal(key in update, false);
  assert.equal(draft.frame_animations_enabled, false);
  assert.equal(source.status, "dnd");
});
test("Editing a cosmetic never truncates legacy profile text; new text respects limits", () => {
  const saved = api.profileDraft({ display_name: "a".repeat(50), bio: "b".repeat(400) });
  assert.doesNotThrow(() => api.validateProfileDraft({ ...saved, profile_frame: "royal" }, saved));
  assert.throws(
    () => api.validateProfileDraft({ ...saved, display_name: "c".repeat(33) }, saved),
    /32/,
  );
  assert.throws(() => api.validateProfileDraft({ ...saved, bio: "c".repeat(161) }, saved), /160/);
  assert.throws(() => api.validateProfileDraft({ ...saved, display_name: " " }, saved), /nome/);
  assert.equal(api.sameProfileDraft(saved, { ...saved }), true);
  assert.equal(api.sameProfileDraft(saved, { ...saved, banner_url: "new" }), false);
});
test("Profile image validation rejects empty, unsupported and oversized files", () => {
  assert.equal(image.validateImage({ size: 100, type: "image/jpeg" }), null);
  assert.ok(image.validateImage({ size: 0, type: "image/png" }));
  assert.ok(image.validateImage({ size: 100, type: "image/svg+xml" }));
  assert.ok(image.validateImage({ size: image.MAX_IMAGE_BYTES + 1, type: "image/png" }));
});
