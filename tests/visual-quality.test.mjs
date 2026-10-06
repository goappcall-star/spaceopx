import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load() {
  const source = fs.readFileSync("src/lib/visual-quality.ts", "utf8");
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module, exports: module.exports },
  );
  return module.exports;
}
test("saved explicit choice wins over OS suggestion, invalid/missing settings follow OS", () => {
  const { resolveVisualQuality: r } = load();
  for (const v of ["normal", "optimized", "maximum"]) assert.equal(r(v, true), v);
  assert.equal(r(null, true), "optimized");
  assert.equal(r("corrupt", false), "normal");
});
test("pre-paint policy matches preferences and tolerates blocked local storage", () => {
  const { VISUAL_QUALITY_BOOTSTRAP: b } = load();
  for (const saved of [null, "normal", "optimized", "maximum"]) {
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(b, {
      document,
      localStorage: { getItem: () => saved },
      matchMedia: () => ({ matches: true }),
    });
    assert.equal(document.documentElement.dataset.visualQuality, saved ?? "optimized");
  }
  assert.doesNotThrow(() =>
    vm.runInNewContext(b, {
      localStorage: {
        getItem: () => {
          throw Error("blocked");
        },
      },
    }),
  );
});
