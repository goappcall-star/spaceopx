import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/lib/theme.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports },
);
test("Theme bootstrap restores saved modes and system preference before rendering", () => {
  for (const [saved, system, expected] of [
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["system", true, "dark"],
    ["system", false, "light"],
    [null, false, "dark"],
    ["invalid", false, "dark"],
  ]) {
    const applied = {};
    const style = {};
    vm.runInNewContext(exports.THEME_BOOTSTRAP, {
      localStorage: { getItem: () => saved },
      matchMedia: () => ({ matches: system }),
      document: {
        documentElement: { classList: { toggle: (name, value) => (applied[name] = value) }, style },
      },
    });
    assert.equal(applied.light, expected === "light");
    assert.equal(applied.dark, expected === "dark");
    assert.equal(style.colorScheme, expected);
  }
  assert.equal(exports.resolvedTheme("system", false), "light");
  assert.equal(exports.normalizeTheme("anything"), "dark");
});
test("Unavailable storage does not prevent the page from starting", () => {
  assert.doesNotThrow(() =>
    vm.runInNewContext(exports.THEME_BOOTSTRAP, {
      localStorage: {
        getItem() {
          throw Error("disabled");
        },
      },
    }),
  );
});
