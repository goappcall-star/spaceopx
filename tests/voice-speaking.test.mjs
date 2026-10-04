import test from "node:test";
import assert from "node:assert/strict";
import { pipelineFixture, loadVoiceProvider } from "./audio/pipeline-fixture.mjs";

test("Microphone analysis resumes audio, holds through syllable gaps, and never highlights mute", async () => {
  let tick,
    now = 100,
    peak = 0;
  const changes = [];
  const f = pipelineFixture({ peak: () => peak });
  const provider = loadVoiceProvider(f.exports, {
    performance: { now: () => now },
    requestAnimationFrame: (callback) => {
      tick = callback;
      return 1;
    },
  });
  provider.micStream = f.input;
  provider.events = { onSpeakingChange: (value) => changes.push(value) };
  await provider.startSpeakingDetection();
  assert.equal(provider.audioPipeline.context.resumed, true);
  tick();
  assert.deepEqual(changes, []);
  peak = 20;
  tick();
  assert.deepEqual(changes, [true]);
  peak = 0;
  now = 250;
  tick();
  assert.deepEqual(changes, [true]);
  now = 341;
  tick();
  assert.deepEqual(changes, [true, false]);
  peak = 20;
  now = 400;
  tick();
  provider.setMuted(true);
  now = 410;
  tick();
  assert.deepEqual(changes, [true, false, true, false]);
  now = 450;
  tick();
  assert.equal(changes.length, 4);
  await provider.disconnect();
  await f.pipeline.dispose();
});
