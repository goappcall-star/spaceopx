import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('Microphone analysis resumes audio, holds through syllable gaps, and never highlights mute', () => {
  let tick, now = 100, peak = 0, resumed = false;
  const changes = [];
  class AudioContext {
    resume() { resumed = true; return Promise.resolve(); }
    createMediaStreamSource() { return { connect() {} }; }
    createGain() { return { gain: { value: 1 }, connect() {} }; }
    createAnalyser() { return { frequencyBinCount: 256, getByteTimeDomainData(buffer) { buffer.fill(128 + peak); } }; }
    createMediaStreamDestination() { return { stream: {} }; }
  }
  const context = { exports: {}, require: () => ({}), crypto: { randomUUID: () => 'session' }, window: { AudioContext }, performance: { now: () => now }, requestAnimationFrame: (callback) => { tick = callback; return 1; }, cancelAnimationFrame() {}, Uint8Array };
  const source = fs.readFileSync(new URL('../src/services/voice.ts', import.meta.url), 'utf8').replaceAll('import.meta.env', '({})');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const provider = context.exports.createVoiceProvider();
  provider.micStream = { getAudioTracks: () => [{ enabled: true }] };
  provider.events = { onSpeakingChange: value => changes.push(value) };
  provider.startSpeakingDetection();
  assert.equal(resumed, true);
  tick(); assert.deepEqual(changes, []);
  peak = 20; tick(); assert.deepEqual(changes, [true]);
  peak = 0; now = 250; tick(); assert.deepEqual(changes, [true]);
  now = 341; tick(); assert.deepEqual(changes, [true, false]);
  peak = 20; now = 400; tick();
  provider.setMuted(true); now = 410; tick();
  assert.deepEqual(changes, [true, false, true, false]);
  now = 450; tick(); assert.equal(changes.length, 4);
});
