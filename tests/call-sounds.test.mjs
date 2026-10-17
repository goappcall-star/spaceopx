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
  for (const kind of [
    "enter",
    "leave",
    "screen-start",
    "mic-mute",
    "mic-unmute",
    "deafen",
    "undeafen",
  ]) {
    const wav = fs.readFileSync(`public/sounds/call-${kind}.wav`);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.equal(wav.readUInt16LE(22), 1);
    assert.ok(wav.length < 15000 && wav.length > 10000);
    assert.ok(wav.subarray(44).some((byte) => byte !== 0));
  }
});

test("Microphone and headphones confirm once, with deafen priority for combined changes", () => {
  const update = runtime.exports.createAudioControlSoundTracker();
  const step = (muted, deafened) => Array.from(update("user", muted, deafened));
  assert.deepEqual(step(false, false), []);
  assert.deepEqual(step(true, false), ["mic-mute"]);
  assert.deepEqual(step(true, false), []);
  assert.deepEqual(step(false, false), ["mic-unmute"]);
  assert.deepEqual(step(true, true), ["deafen"]);
  assert.deepEqual(step(true, false), ["undeafen"]);
  assert.deepEqual(step(true, true), ["deafen"]);
  assert.deepEqual(step(false, false), ["undeafen"]);
});

test("Initial state, session changes and disabled playback do not replay confirmations", () => {
  const update = runtime.exports.createAudioControlSoundTracker();
  assert.deepEqual(Array.from(update("user", true, true)), []);
  update("user", false, false); // Consumed even when playback disabled.
  assert.deepEqual(Array.from(update("user", false, false)), []);
  assert.deepEqual(Array.from(update(null, false, false)), []);
  assert.deepEqual(Array.from(update("another-user", true, false)), []);
});

test("Only local control confirmations may bypass deafen, never call or screen cues", () => {
  for (const sound of ["mic-mute", "mic-unmute", "deafen", "undeafen"])
    assert.equal(runtime.exports.isAudioControlSound(sound), true);
  for (const sound of ["enter", "leave", "screen-start"])
    assert.equal(runtime.exports.isAudioControlSound(sound), false);
});

test("Screen cue only follows successful capture starts, including restart", () => {
  const update = runtime.exports.createScreenShareSoundTracker();
  const step = (active) => Array.from(update(active));
  assert.deepEqual(step(false), []); // Cancelled picker or denied permission.
  assert.deepEqual(step(true), ["screen-start"]);
  assert.deepEqual(step(true), []); // Rerenders, quality changes, reconnect.
  assert.deepEqual(step(false), []); // Stop or call exit.
  assert.deepEqual(step(true), ["screen-start"]);
});

test("Server and private capture trackers are independent and do not replay skipped cues", () => {
  const server = runtime.exports.createScreenShareSoundTracker();
  const privateCall = runtime.exports.createScreenShareSoundTracker();
  server(true); // Consumed even when playback is disabled by preferences.
  assert.deepEqual(Array.from(server(true)), []);
  assert.deepEqual(Array.from(privateCall(true)), ["screen-start"]);
  privateCall(false);
  assert.deepEqual(Array.from(server(true)), []);
});
