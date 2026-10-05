import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";

export function pipelineFixture({
  failModule = false,
  waitReady = false,
  peak = () => 0,
  timeoutMs = 8000,
} = {}) {
  const contexts = [],
    worklets = [];
  class Node {
    connections = [];
    connect(node) {
      this.connections.push(node);
      return node;
    }
    disconnect() {
      this.connections = [];
    }
  }
  const track = (id) => ({
    id,
    enabled: true,
    readyState: "live",
    applied: [],
    getConstraints: () => ({
      echoCancellation: true,
      autoGainControl: true,
      deviceId: { exact: id },
    }),
    async applyConstraints(value) {
      this.applied.push(value);
    },
    stop() {
      this.readyState = "ended";
    },
  });
  const stream = (id) => {
    const audio = track(id);
    return { getAudioTracks: () => [audio], getTracks: () => [audio] };
  };
  class Context {
    state = "running";
    sampleRate = 48000;
    constructor() {
      contexts.push(this);
    }
    audioWorklet = {
      addModule: async () => {
        if (failModule) throw Error("missing model");
      },
    };
    async resume() {
      this.resumed = true;
    }
    async close() {
      this.state = "closed";
    }
    createGain() {
      return Object.assign(new Node(), { gain: { value: 1 } });
    }
    createAnalyser() {
      return Object.assign(new Node(), {
        frequencyBinCount: 256,
        getByteTimeDomainData(buffer) {
          buffer.fill(128 + peak());
        },
      });
    }
    createMediaStreamSource(input) {
      return Object.assign(new Node(), { input });
    }
    createMediaStreamDestination() {
      return Object.assign(new Node(), { stream: stream("processed-" + contexts.length) });
    }
  }
  class Worklet extends Node {
    constructor() {
      super();
      worklets.push(this);
      this.port = {
        onmessage: null,
        close: () => {
          this.port.closed = true;
        },
        postMessage: (message) => {
          if (message.type === "dispose") {
            this.destroyed = true;
            queueMicrotask(() => this.port.onmessage?.({ data: { type: "disposed" } }));
          }
        },
      };
      if (!waitReady) queueMicrotask(() => this.ready());
    }
    ready() {
      this.port.onmessage?.({ data: { type: "ready" } });
    }
    fail() {
      this.port.onmessage?.({ data: { type: "error" } });
    }
  }
  const environment = {
    exports: {},
    require: () => ({ RNNOISE_WORKLET_URL: "/audio/test.js" }),
    AudioContext: Context,
    AudioWorkletNode: Worklet,
    AbortController,
    DOMException,
    setTimeout: (callback, ms) => setTimeout(callback, ms === 8000 ? timeoutMs : ms),
    clearTimeout,
  };
  const source = fs.readFileSync(
    new URL("../../src/services/audio-processing.ts", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    environment,
  );
  const pipeline = new environment.exports.MicrophoneAudioPipeline((status) =>
    statuses.push(status),
  );
  const statuses = [];
  const input = stream("microphone");
  pipeline.attachMicrophone(input);
  return {
    pipeline,
    input,
    contexts,
    worklets,
    statuses,
    stream,
    exports: environment.exports,
    Context,
  };
}

export function loadVoiceProvider(audioExports, additions = {}) {
  const environment = {
    exports: {},
    require: (id) => {
      if (id === "./audio-processing") return audioExports;
      if (id === "@/integrations/supabase/client")
        return { supabase: { removeChannel: async () => undefined } };
      if (id === "./remote-track") {
        const remoteEnvironment = { exports: {} };
        vm.runInNewContext(
          ts.transpileModule(
            fs.readFileSync(new URL("../../src/services/remote-track.ts", import.meta.url), "utf8"),
            { compilerOptions: { module: ts.ModuleKind.CommonJS } },
          ).outputText,
          remoteEnvironment,
        );
        return remoteEnvironment.exports;
      }
      assert.fail(`Unexpected import ${id}`);
    },
    crypto: { randomUUID: () => "session" },
    performance: { now: () => 100 },
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    Uint8Array,
    setTimeout,
    clearTimeout,
    DOMException,
    ...additions,
  };
  const source = fs
    .readFileSync(new URL("../../src/services/voice.ts", import.meta.url), "utf8")
    .replaceAll("import.meta.env", "({})");
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    environment,
  );
  return environment.exports.createVoiceProvider();
}
