import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const env = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/sidebar-drag.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  env,
);
const move = (...args) => Array.from(env.exports.reorderCategoryIds(...args));
test("Dragging categories in either direction uses the target's before/after boundary", () => {
  const ids = ["a", "b", "c", "d"];
  assert.deepEqual(move(ids, "a", "c", true), ["b", "c", "a", "d"]);
  assert.deepEqual(move(ids, "a", "c", false), ["b", "a", "c", "d"]);
  assert.deepEqual(move(ids, "d", "b", false), ["a", "d", "b", "c"]);
  assert.deepEqual(move(ids, "d", "b", true), ["a", "b", "d", "c"]);
  assert.deepEqual(ids, ["a", "b", "c", "d"]);
});
test("Dropping onto itself or an unavailable category leaves order unchanged", () => {
  assert.deepEqual(move(["a", "b"], "a", "a", true), ["a", "b"]);
  assert.deepEqual(move(["a", "b"], "missing", "b", true), ["a", "b"]);
  assert.deepEqual(move(["a", "b"], "a", "missing", false), ["a", "b"]);
});
