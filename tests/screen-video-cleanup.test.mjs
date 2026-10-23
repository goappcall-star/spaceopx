import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
test("Leaving screen playback releases the video element without stopping received shared tracks", () => {
  let effect,
    paused = 0,
    stopped = 0;
  const stream = { getTracks: () => [{ stop: () => stopped++ }] };
  const element = { srcObject: null, play: async () => {}, pause: () => paused++ };
  const imports = {
    react: { useRef: () => ({ current: element }), useEffect: (fn) => (effect = fn) },
    "react/jsx-runtime": { jsx: () => ({}) },
    "@/lib/utils": { cn: () => "" },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/components/voice/VideoSurface.tsx", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { exports, require: (name) => imports[name] },
  );
  exports.VideoSurface({ stream });
  const cleanup = effect();
  assert.equal(element.srcObject, stream);
  cleanup();
  assert.equal(element.srcObject, null);
  assert.equal(paused, 1);
  assert.equal(stopped, 0);
});
