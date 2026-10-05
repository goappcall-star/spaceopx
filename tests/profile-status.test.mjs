import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(new URL("../src/lib/profile-status.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports },
);

test("Every supported presence can be saved; empty form events and unknown statuses are rejected", () => {
  for (const status of ["online", "idle", "dnd", "offline"]) {
    assert.equal(exports.isUserStatus(status), true);
    assert.doesNotThrow(() => exports.validateProfileStatus(status));
  }
  for (const invalid of ["", undefined, null, "invisible", "Online"]) {
    assert.equal(exports.isUserStatus(invalid), false);
    assert.throws(() => exports.validateProfileStatus(invalid), /Selecione um status válido/);
  }
});

test("Plain PostgREST errors identify invalid presence without exposing database details", () => {
  assert.equal(
    exports.profileSaveErrorMessage({
      message: 'new row violates check constraint "profiles_status_check"',
      code: "23514",
    }),
    "Selecione um status válido antes de salvar o perfil.",
  );
  assert.equal(
    exports.profileSaveErrorMessage({ message: "username_is_permanent" }),
    "Seu username é permanente e não pode ser alterado.",
  );
  assert.equal(exports.profileSaveErrorMessage(null), "Não foi possível salvar o perfil.");
  assert.equal(
    exports.profileSaveErrorMessage({ message: "private token or URL" }),
    "Não foi possível salvar o perfil.",
  );
});
