import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { buildAudioWorklet } from "../scripts/build-audio-worklet.mjs";

test("The shipped AudioWorklet runs real RNNoise/WASM, reduces noise, and acknowledges WASM disposal", async () => {
  await buildAudioWorklet();
  const manifest = await fs.readFile(
    new URL("../src/generated/audio-worklet.ts", import.meta.url),
    "utf8",
  );
  const url = manifest.match(/"(\/audio\/[^\"]+)"/)[1];
  const source = (
    await fs.readFile(new URL("../public" + url, import.meta.url), "utf8")
  ).replaceAll("import.meta.url", JSON.stringify("https://lobbyx.test" + url));
  let Processor;
  const messages = [];
  class Base {
    port = { onmessage: null, postMessage: (data) => messages.push(data) };
  }
  const context = {
    AudioWorkletProcessor: Base,
    sampleRate: 48000,
    registerProcessor: (name, type) => {
      assert.equal(name, "lobbyx-rnnoise-v1");
      Processor = type;
    },
    WebAssembly,
    console,
    atob,
    URL,
    Uint8Array,
    Int8Array,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
  };
  vm.runInNewContext(source, context);
  const processor = new Processor();
  const start = Date.now();
  while (!messages.some((message) => message.type === "ready")) {
    assert.ok(
      !messages.some((message) => message.type === "error"),
      "WASM initialization must succeed in AudioWorkletGlobalScope without Window or WorkerGlobalScope",
    );
    assert.ok(Date.now() - start < 5000, "Model must acknowledge readiness");
    await new Promise((resolve) => setImmediate(resolve));
  }
  let seed = 123,
    inputEnergy = 0,
    outputEnergy = 0;
  const input = new Float32Array(128),
    output = new Float32Array(128);
  for (let block = 0; block < 1500; block++) {
    for (let i = 0; i < input.length; i++) {
      seed = (1664525 * seed + 1013904223) >>> 0;
      input[i] = (seed / 2147483648 - 1) * 0.035;
    }
    assert.equal(processor.process([[input]], [[output]]), true);
    if (block > 375)
      for (let i = 0; i < 128; i++) {
        inputEnergy += input[i] ** 2;
        outputEnergy += output[i] ** 2;
        assert.ok(Number.isFinite(output[i]));
      }
  }
  assert.ok(
    10 * Math.log10(inputEnergy / outputEnergy) > 6,
    "Real WASM must suppress the audio, not just connect a pass-through node",
  );
  processor.port.onmessage({ data: { type: "dispose" } });
  assert.ok(messages.some((message) => message.type === "disposed"));
  assert.equal(processor.processor, null);
  assert.equal(processor.process([[input]], [[output]]), false);
});
