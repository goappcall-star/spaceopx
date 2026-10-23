import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
test("The private call's existing player obeys the shared headphone control without changing incoming tracks", async () => {
  let deafened = true;
  const effects = [];
  const element = { srcObject: null, muted: false, volume: 1, play: async () => {} };
  const volumeModule = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/lib/audio-volume.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    volumeModule,
  );
  const imports = {
    react: {
      useRef: () => ({ current: element }),
      useState: () => [false, () => {}],
      useCallback: (fn) => fn,
      useEffect: (fn) => effects.push(fn),
    },
    "react/jsx-runtime": { jsx: () => ({}), jsxs: () => ({}) },
    "@/hooks/use-voice": { useVoice: () => ({ deafened }) },
    "@/hooks/use-audio-settings": { useAudioSettings: () => ({ settings: { outputVolume: 70 } }) },
    "@/lib/audio-volume": volumeModule.exports,
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync("src/components/call/CallOverlay.tsx", "utf8") + "\nexport { CallAudio };",
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    { exports, require: (name) => imports[name] ?? {} },
  );
  const stream = {};
  const render = () => {
    effects.length = 0;
    exports.CallAudio({ stream, volume: 80 });
    effects.forEach((fn) => fn());
  };
  render();
  assert.equal(element.volume, 0);
  assert.equal(element.srcObject, stream);
  deafened = false;
  render();
  assert.ok(Math.abs(element.volume - 0.56) < 0.0001);
  assert.equal(element.srcObject, stream);
});
