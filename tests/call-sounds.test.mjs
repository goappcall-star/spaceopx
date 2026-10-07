import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const runtime = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("src/services/call-sounds.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  runtime,
);
const tracker = () => {
  const update = runtime.exports.createCallSoundTracker();
  return (...args) => Array.from(update(...args));
};
test("Successful entry, remote entry/exit and local leave each sound once", () => {
  const update = tracker();
  assert.deepEqual(update("server-room", false, []), []);
  assert.deepEqual(update("server-room", true, ["other"]), ["enter"]);
  assert.deepEqual(update("server-room", true, ["other"]), []);
  assert.deepEqual(update("server-room", true, ["other", "new"]), ["enter"]);
  assert.deepEqual(update("server-room", true, ["other"]), ["leave"]);
  assert.deepEqual(update(null, false, []), ["leave"]);
  assert.deepEqual(update(null, false, []), []);
});
test("Reconnect and failed startup are silent; moving to another room emits leave and enter", () => {
  const update = tracker();
  update("private", true, ["other"]);
  assert.deepEqual(update("private", false, []), []);
  assert.deepEqual(update("private", true, ["other"]), []);
  assert.deepEqual(update("different", true, []), ["leave", "enter"]);
  const failure = tracker();
  failure("private", false, []);
  assert.deepEqual(failure(null, false, []), []);
});
test("Original audio assets are short nonempty mono PCM WAV files", () => {
  for (const kind of ["enter", "leave"]) {
    const wav = fs.readFileSync(`public/sounds/call-${kind}.wav`);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.readUInt16LE(22), 1);
    assert.ok(wav.length < 15000 && wav.length > 10000);
    assert.ok(wav.subarray(44).some((byte) => byte !== 0));
  }
});
