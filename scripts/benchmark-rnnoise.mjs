import { adaptRnnoiseForWorklet } from "./rnnoise-worklet-adapter.mjs";
import { RnnoiseFrameBuffer } from "../src/audio/rnnoise-frame-buffer.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import os from "node:os";
// Execute the exact WASM wrapper used in the worklet, rather than a DSP mock.
const original = await readFile("node_modules/@shiguredo/rnnoise-wasm/dist/rnnoise.js", "utf8");
const adapted = adaptRnnoiseForWorklet(original).replaceAll(
  "import.meta.url",
  JSON.stringify(
    new URL("../node_modules/@shiguredo/rnnoise-wasm/dist/rnnoise.js", import.meta.url).href,
  ),
);
const { Rnnoise } = await import(
  "data:text/javascript;base64," + Buffer.from(adapted).toString("base64")
);

const startLoad = performance.now();
const model = await Rnnoise.load();
const loadMs = performance.now() - startLoad;
if (model.frameSize !== 480) throw Error("Invalid RNNoise frame size");
const wave = await readFile("tests/audio/speech.wav");
let offset = 12,
  sampleRate,
  pcm;
while (offset + 8 < wave.length) {
  const id = wave.toString("ascii", offset, offset + 4),
    size = wave.readUInt32LE(offset + 4);
  if (id === "fmt ") {
    if (wave.readUInt16LE(offset + 8) !== 1 || wave.readUInt16LE(offset + 22) !== 16)
      throw Error("Expected PCM16 WAV");
    sampleRate = wave.readUInt32LE(offset + 12);
  }
  if (id === "data") {
    pcm = wave.subarray(offset + 8, offset + 8 + size);
    break;
  }
  offset += 8 + size + (size % 2);
}
if (!sampleRate || !pcm) throw Error("Invalid speech fixture");
const speech = new Float32Array(Math.floor(((pcm.length / 2) * 48000) / sampleRate));
for (let i = 0; i < speech.length; i++) {
  const pos = (i * sampleRate) / 48000,
    j = Math.floor(pos),
    mix = pos - j;
  const a = pcm.readInt16LE(j * 2) / 32768,
    b = pcm.readInt16LE(Math.min(j + 1, pcm.length / 2 - 1) * 2) / 32768;
  speech[i] = a + (b - a) * mix;
}
const frame = new Float32Array(480),
  state = model.createDenoiseState();
let seed = 123,
  rawEnergy = 0,
  outputEnergy = 0;
const samples = [],
  cpuStart = process.cpuUsage(),
  benchmarkStart = performance.now();
// 30 seconds of stationary noise, then a speech+noise workload for timing.
for (let n = 0; n < 6000; n++) {
  for (let i = 0; i < 480; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    const noise = (seed / 2147483648 - 1) * 0.035;
    frame[i] = (noise + (n >= 3000 ? speech[(n * 480 + i) % speech.length] * 0.8 : 0)) * 32768;
    if (n > 100 && n < 3000) rawEnergy += noise * noise;
  }
  const before = performance.now();
  state.processFrame(frame);
  samples.push(performance.now() - before);
  if (n > 100 && n < 3000) for (const x of frame) outputEnergy += (x / 32768) ** 2;
}
const elapsedMs = performance.now() - benchmarkStart,
  cpu = process.cpuUsage(cpuStart);
state.destroy();
samples.sort((a, b) => a - b);

// Measure clean speech correlation including our real frame buffering.
const buffer = new RnnoiseFrameBuffer(model.createDenoiseState());
const clean = new Float32Array(48000 * 3),
  output = new Float32Array(clean.length);
for (let i = 4800; i < clean.length - 4800; i++)
  clean[i] = speech[(i - 4800) % speech.length] * 0.8;
for (let i = 0; i + 128 <= clean.length; i += 128)
  buffer.process(clean.subarray(i, i + 128), output.subarray(i, i + 128));
buffer.destroy();
let best = -Infinity,
  bestLag = 0;
for (let lag = 0; lag < 1600; lag++) {
  let cross = 0;
  for (let i = 5000; i < 40000; i++) cross += clean[i] * output[i + lag];
  if (cross > best) {
    best = cross;
    bestLag = lag;
  }
}
const report = {
  engine: "RNNoise @shiguredo/rnnoise-wasm 2025.1.5",
  node: process.version,
  cpuModel: os.cpus()[0]?.model,
  frames: samples.length,
  audioSeconds: 60,
  loadMs,
  meanFrameMs: samples.reduce((a, b) => a + b, 0) / samples.length,
  p95FrameMs: samples[Math.floor(samples.length * 0.95)],
  p99FrameMs: samples[Math.floor(samples.length * 0.99)],
  maxFrameMs: samples.at(-1),
  benchmarkWallMs: elapsedMs,
  computePercentOfOneCore: ((cpu.user + cpu.system) / 1000 / 60000) * 100,
  whiteNoiseReductionDb: 10 * Math.log10(rawEnergy / outputEnergy),
  fifoDelayMs: 512 / 48,
  measuredCleanSpeechLagSamples: bestLag,
  measuredCleanSpeechLagMs: bestLag / 48,
  scope:
    "Local Node/WASM processing benchmark; excludes browser capture, codec, jitter buffer and network. Lag measured by speech cross-correlation, not end-to-end latency.",
};
if (report.whiteNoiseReductionDb < 6 || report.p95FrameMs >= 10)
  throw Error("RNNoise benchmark failed: " + JSON.stringify(report));
const reportPath = process.argv[2];
if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
