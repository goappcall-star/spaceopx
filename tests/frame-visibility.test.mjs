import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import vm from "node:vm";
test("Visible frames share one observer and release it after the last profile closes", () => {
  const effects = [],
    observed = new Set(),
    states = [];
  let callback,
    constructions = 0,
    disconnected = 0;
  const exports = {};
  class Observer {
    constructor(cb) {
      callback = cb;
      constructions++;
    }
    observe(node) {
      observed.add(node);
    }
    unobserve(node) {
      observed.delete(node);
    }
    disconnect() {
      disconnected++;
    }
  }
  let currentNode;
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(new URL("../src/hooks/use-frame-visibility.ts", import.meta.url), "utf8"),
      {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
    {
      exports,
      IntersectionObserver: Observer,
      require: () => ({
        useRef: () => ({ current: currentNode }),
        useState: () => [false, (value) => states.push(value)],
        useEffect: (cb) => effects.push(cb),
      }),
    },
  );
  const a = {},
    b = {};
  currentNode = a;
  exports.useFrameVisibility(true);
  const cleanupA = effects.shift()();
  currentNode = b;
  exports.useFrameVisibility(true);
  const cleanupB = effects.shift()();
  assert.equal(constructions, 1);
  assert.equal(observed.size, 2);
  callback([
    { target: a, isIntersecting: true },
    { target: b, isIntersecting: false },
  ]);
  assert.deepEqual(states, [true, false]);
  cleanupA();
  assert.equal(observed.size, 1);
  assert.equal(disconnected, 0);
  cleanupB();
  assert.equal(observed.size, 0);
  assert.equal(disconnected, 1);
  currentNode = {};
  exports.useFrameVisibility(false);
  effects.shift()();
  assert.equal(constructions, 1, "static thumbnails never allocate observers");
});
