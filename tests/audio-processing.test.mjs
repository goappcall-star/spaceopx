import test from "node:test";
import assert from "node:assert/strict";
import { pipelineFixture, loadVoiceProvider } from "./audio/pipeline-fixture.mjs";
import { RnnoiseFrameBuffer } from "../src/audio/rnnoise-frame-buffer.mjs";

test("Leaving bounds signaling acknowledgements while releasing the old microphone and peers", async () => {
  const f = pipelineFixture();
  const provider = loadVoiceProvider(f.exports);
  provider.micStream = f.input;
  await provider.startSpeakingDetection();
  const destination = provider.outgoingAudioTrack();
  const operations = [];
  provider.signaling = {
    async send(payload, options) {
      assert.equal(payload.payload.bye, true);
      assert.equal(options.timeout, 500);
      operations.push("bye");
    },
    async unsubscribe(timeout) {
      assert.equal(timeout, 500);
      assert.equal(destination.readyState, "ended");
      assert.equal(f.input.getAudioTracks()[0].readyState, "ended");
      operations.push("unsubscribe");
    },
  };
  await provider.disconnect();
  assert.deepEqual(operations, ["bye", "unsubscribe"]);
  assert.equal(provider.signaling, null);
  assert.equal(provider.audioPipeline, null);
  await f.pipeline.dispose();
});

test("A failed microphone switch preserves the current track and allows retrying the same device", async () => {
  const f = pipelineFixture();
  let attempts = 0;
  const provider = loadVoiceProvider(f.exports, {
    navigator: {
      mediaDevices: {
        getUserMedia: async () => {
          if (++attempts === 1) throw new DOMException("Device unavailable", "NotFoundError");
          return f.stream("retry-mic");
        },
      },
    },
  });
  provider.micStream = f.input;
  await provider.startSpeakingDetection();
  const outgoing = provider.outgoingAudioTrack();
  await assert.rejects(provider.setDevices({ microphoneId: "retry-mic" }), /unavailable/);
  assert.equal(provider.micStream, f.input);
  assert.equal(provider.outgoingAudioTrack(), outgoing);
  await provider.setDevices({ microphoneId: "retry-mic" });
  assert.equal(attempts, 2);
  assert.equal(provider.outgoingAudioTrack(), outgoing);
  await provider.audioPipeline.dispose();
  await f.pipeline.dispose();
});

test("Frame adapter keeps exactly 512 samples of delay, normalization, and order across frame boundaries", () => {
  const buffer = new RnnoiseFrameBuffer({
    processFrame(frame) {
      for (let i = 0; i < frame.length; i++) frame[i] *= 0.5;
    },
    destroy() {},
  });
  const input = Float32Array.from({ length: 128 * 100 }, (_, i) => (i + 1) / 20000);
  const result = new Float32Array(input.length);
  for (let start = 0; start < input.length; start += 128)
    buffer.process(input.subarray(start, start + 128), result.subarray(start, start + 128));
  assert.deepEqual([...result.subarray(0, 512)], Array(512).fill(0));
  for (let i = 512; i < result.length; i++) assert.equal(result[i], input[i - 512] * 0.5);
  assert.equal(buffer.frames, Math.floor(input.length / 480));
});

test("Modes rewire the real pipeline before gain and keep the same WebRTC sender track", async () => {
  const f = pipelineFixture();
  const provider = loadVoiceProvider(f.exports);
  provider.micStream = f.input;
  await provider.setNoiseSuppression("advanced");
  await provider.startSpeakingDetection();
  const pipeline = provider.audioPipeline;
  const track = provider.outgoingAudioTrack();
  const replaced = [];
  provider.peers.set("peer", {
    transceivers: {
      mic: {
        sender: {
          async replaceTrack(value) {
            replaced.push(value);
          },
        },
      },
    },
  });
  provider.applyLocalTrack("mic", provider.localTrack("mic"));
  assert.equal(replaced[0], pipeline.stream.getAudioTracks()[0]);
  assert.notEqual(track, f.input.getAudioTracks()[0]);
  assert.equal(pipeline.source.connections[0], pipeline.denoiser);
  assert.equal(pipeline.denoiser.connections[0], pipeline.gain);
  provider.setInputGain(150);
  assert.equal(pipeline.gain.gain.value, 1.5);
  provider.setMuted(true);
  assert.equal(track.enabled, false);
  assert.equal(f.input.getAudioTracks()[0].enabled, false);
  await provider.setNoiseSuppression("standard");
  assert.equal(provider.outgoingAudioTrack(), track);
  assert.equal(pipeline.source.connections[0], pipeline.gain);
  assert.equal(f.input.getAudioTracks()[0].applied.at(-1).noiseSuppression, true);
  assert.equal(track.enabled, false);
  await provider.setNoiseSuppression("off");
  assert.equal(f.input.getAudioTracks()[0].applied.at(-1).noiseSuppression, false);
  provider.setMuted(false);
  assert.equal(track.enabled, true);
  await pipeline.dispose();
  await f.pipeline.dispose();
});

test("Microphone switch retains the destination, gain, mute, and advanced mode", async () => {
  const f = pipelineFixture();
  const provider = loadVoiceProvider(f.exports, {
    navigator: { mediaDevices: { getUserMedia: async () => f.stream("new-mic") } },
  });
  provider.micStream = f.input;
  await provider.setNoiseSuppression("advanced");
  await provider.startSpeakingDetection();
  const pipeline = provider.audioPipeline,
    destination = provider.outgoingAudioTrack();
  provider.setInputGain(70);
  provider.setMuted(true);
  await provider.setDevices({ microphoneId: "new-mic" });
  assert.equal(provider.audioPipeline, pipeline);
  assert.equal(provider.outgoingAudioTrack(), destination);
  assert.equal(destination.enabled, false);
  assert.equal(pipeline.gain.gain.value, 0.7);
  assert.equal(pipeline.effective, "advanced");
  assert.equal(f.input.getAudioTracks()[0].readyState, "ended");
  assert.equal(provider.micStream.getAudioTracks()[0].enabled, false);
  await provider.disconnect();
  assert.equal(pipeline.context.state, "closed");
  assert.equal(destination.readyState, "ended");
  assert.equal(provider.audioPipeline, null);
  await f.pipeline.dispose();
});

test("Returning from a custom microphone to the system default captures without an exact device id", async () => {
  const f = pipelineFixture();
  const captures = [];
  const provider = loadVoiceProvider(f.exports, {
    navigator: {
      mediaDevices: {
        getUserMedia: async (constraints) => {
          captures.push(constraints);
          return f.stream("next-mic");
        },
      },
    },
  });
  provider.micStream = f.input;
  await provider.startSpeakingDetection();
  const destination = provider.outgoingAudioTrack();
  await provider.setDevices({ microphoneId: "custom" });
  assert.equal(captures[0].audio.deviceId.exact, "custom");
  await provider.setDevices({ microphoneId: null });
  assert.equal(captures[1].audio.deviceId, undefined);
  assert.equal(provider.outgoingAudioTrack(), destination);
  await provider.disconnect();
  await f.pipeline.dispose();
});

test("Missing model falls back to Standard with connected audio and visible status", async () => {
  const f = pipelineFixture({ failModule: true });
  await f.pipeline.setMode("advanced");
  assert.equal(f.pipeline.effective, "standard");
  assert.equal(f.pipeline.source.connections[0], f.pipeline.gain);
  assert.equal(f.statuses.at(-1).fallback, true);
  assert.equal(f.input.getAudioTracks()[0].applied.at(-1).noiseSuppression, true);
  await f.pipeline.dispose();
});

test("Worklet runtime failure detaches ML, restores Standard, and releases state", async () => {
  const f = pipelineFixture();
  await f.pipeline.setMode("advanced");
  const node = f.worklets[0];
  node.fail();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.pipeline.source.connections[0], f.pipeline.gain);
  assert.equal(f.pipeline.effective, "standard");
  assert.equal(f.statuses.at(-1).fallback, true);
  assert.equal(node.destroyed, true);
  assert.equal(node.port.closed, true);
  await f.pipeline.dispose();
});

test("Changing mode during load cancels RNNoise without stale reconnection or leaked state", async () => {
  const f = pipelineFixture({ waitReady: true });
  const loading = f.pipeline.setMode("advanced");
  for (let i = 0; i < 15; i++) await Promise.resolve();
  assert.equal(f.worklets.length, 1);
  await f.pipeline.setMode("off");
  await loading;
  assert.equal(f.worklets[0].destroyed, true);
  assert.equal(f.pipeline.effective, "off");
  assert.equal(f.pipeline.source.connections[0], f.pipeline.gain);
  f.worklets[0].ready();
  assert.equal(f.pipeline.effective, "off");
  await f.pipeline.dispose();
});

test("Ending call during model load stops destination and closes AudioContext without late activation", async () => {
  const f = pipelineFixture({ waitReady: true });
  const loading = f.pipeline.setMode("advanced");
  for (let i = 0; i < 15; i++) await Promise.resolve();
  await f.pipeline.dispose();
  await loading;
  assert.equal(f.pipeline.context.state, "closed");
  assert.equal(f.pipeline.stream.getAudioTracks()[0].readyState, "ended");
  assert.equal(f.worklets[0].destroyed, true);
});

test("A model that never reports ready times out and restores the connected Standard path", async () => {
  const f = pipelineFixture({ waitReady: true, timeoutMs: 20 });
  await f.pipeline.setMode("advanced");
  assert.equal(f.pipeline.effective, "standard");
  assert.equal(f.statuses.at(-1).fallback, true);
  assert.equal(f.pipeline.source.connections[0], f.pipeline.gain);
  assert.equal(f.worklets[0].destroyed, true);
  await f.pipeline.dispose();
});
