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

test("Both receivers detect the other microphone, hold pauses, clear silence and release analysers", async () => {
  let now = 100;
  class Stream {
    constructor(tracks) {
      this.tracks = tracks;
    }
    getAudioTracks() {
      return this.tracks;
    }
  }
  const receivers = [];
  for (const id of ["alice", "bob"]) {
    let tick;
    const f = pipelineFixture();
    const changes = [];
    const provider = loadVoiceProvider(f.exports, {
      MediaStream: Stream,
      performance: { now: () => now },
      requestAnimationFrame: (callback) => {
        tick = callback;
        return 1;
      },
    });
    provider.micStream = f.input;
    provider.events = { onRemoteSpeakingChange: (value) => changes.push({ ...value }) };
    await provider.startSpeakingDetection();
    const remoteId = id === "alice" ? "bob" : "alice";
    const track = { id: remoteId, kind: "audio", readyState: "live", muted: false };
    provider.remote = { [remoteId]: { audio: new Stream([track]), camera: null, screen: null } };
    provider.emitRemote();
    const detector = provider.remoteDetectors.get(remoteId);
    assert.ok(detector);
    let peak = 20;
    detector.analyser.getByteTimeDomainData = (buffer) => buffer.fill(128 + peak);
    provider.setUserVolume(remoteId, 0);
    tick();
    assert.equal(
      changes.at(-1)[remoteId],
      true,
      "received voice lights the other user even at playback volume zero",
    );
    peak = 0;
    now += 100;
    tick();
    assert.equal(changes.at(-1)[remoteId], true);
    now += 241;
    tick();
    assert.equal(changes.at(-1)[remoteId], false);
    peak = 20;
    tick();
    track.muted = true;
    tick();
    assert.equal(changes.at(-1)[remoteId], false);
    delete provider.remote[remoteId];
    provider.emitRemote();
    assert.equal(provider.remoteDetectors.size, 0);
    assert.equal(detector.source.connections.length, 0);
    assert.equal(Object.keys(changes.at(-1)).length, 0);
    receivers.push({ provider, f });
  }
  for (const { provider, f } of receivers) {
    await provider.disconnect();
    assert.equal(provider.detectionSink, null);
    assert.equal(provider.audioPipeline, null);
    await f.pipeline.dispose();
  }
});
