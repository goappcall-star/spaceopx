import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { pipelineFixture, loadVoiceProvider } from "./audio/pipeline-fixture.mjs";

function load(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (id) => {
        assert.ok(id in imports, id);
        return imports[id];
      },
      ...globals,
    },
  );
  return exports;
}
const volume = load("src/lib/audio-volume.ts", {});
const options = {
  inputDeviceId: null,
  outputDeviceId: "headset",
  inputVolume: 50,
  outputVolume: 50,
  noiseSuppression: "standard",
};
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture({ capture, sink, play, peak = 18 } = {}) {
  const f = pipelineFixture({ peak: () => peak });
  const elements = [],
    captures = [],
    intervals = new Map(),
    timeouts = new Map();
  const microphone = f.stream("test-input");
  microphone.getAudioTracks()[0].addEventListener = (name, fn) => {
    microphone.ended = fn;
  };
  f.Context.prototype.createOscillator = () => ({
    frequency: { value: 0 },
    connect() {},
    start() {},
  });
  const api = load(
    "src/services/microphone-test.ts",
    { "./audio-processing": f.exports, "@/lib/audio-volume": volume },
    {
      AudioContext: f.Context,
      navigator: {
        mediaDevices: {
          async getUserMedia(value) {
            captures.push(value);
            return capture ? capture() : microphone;
          },
        },
      },
      document: {
        createElement() {
          const element = {
            srcObject: null,
            volume: 1,
            pauses: 0,
            plays: 0,
            async setSinkId(id) {
              this.sink = id;
              if (sink) await sink();
            },
            async play() {
              this.plays++;
              if (play) await play();
            },
            pause() {
              this.pauses++;
            },
          };
          elements.push(element);
          return element;
        },
      },
      setInterval(fn) {
        const id = Symbol();
        intervals.set(id, fn);
        return id;
      },
      clearInterval(id) {
        intervals.delete(id);
      },
      setTimeout(fn) {
        const id = Symbol();
        timeouts.set(id, fn);
        return id;
      },
      clearTimeout(id) {
        timeouts.delete(id);
      },
    },
  );
  let ended = 0;
  const session = new api.MicrophoneTestSession(() => {
    ended++;
  });
  return {
    ...f,
    ...api,
    session,
    elements,
    microphone,
    captures,
    intervals,
    timeouts,
    ended: () => ended,
  };
}

test("global gain rejects legacy amplification, negatives and non-finite data at the real DSP boundary", async () => {
  const f = fixture();
  const provider = loadVoiceProvider(f.exports);
  provider.micStream = f.input;
  await provider.startSpeakingDetection();
  for (const [value, expected] of [
    [0, 0],
    [50, 0.5],
    [100, 1],
    [200, 1],
    [-1, 0],
    [NaN, 1],
    [Infinity, 1],
  ]) {
    provider.setInputGain(value);
    assert.equal(provider.audioPipeline.gain.gain.value, expected);
    f.pipeline.setGain(value);
    assert.equal(f.pipeline.gain.gain.value, expected);
  }
  assert.equal(volume.receivedAudioVolume(50, 200, false), 0.5);
  await provider.audioPipeline.dispose();
  await f.pipeline.dispose();
});

test("monitor borrows the call without capture or changes to mute/PTT, stream, gain or sender", async () => {
  const f = fixture();
  f.pipeline.setGain(50);
  f.pipeline.setMuted(true);
  const values = [];
  await f.session.start(options, (level) => values.push(level));
  assert.equal(f.captures.length, 0);
  assert.equal(f.session.borrowed, true);
  assert.equal(f.elements[0].srcObject, f.pipeline.stream);
  assert.equal(f.elements[0].sink, "headset");
  assert.equal(f.elements[0].volume, 0.5);
  f.intervals.values().next().value();
  assert.ok(values[0] > 0 && values[0] <= 1);
  f.session.setVolumes(999, 999);
  assert.equal(f.pipeline.gain.gain.value, 0.5);
  assert.equal(f.elements[0].volume, 1);
  f.session.stop();
  assert.equal(f.input.getAudioTracks()[0].enabled, false);
  assert.equal(f.pipeline.stream.getAudioTracks()[0].enabled, false);
  assert.equal(f.input.getAudioTracks()[0].readyState, "live");
  assert.equal(f.pipeline.stream.getAudioTracks()[0].readyState, "live");
  assert.equal(f.elements[0].srcObject, null);
  assert.equal(f.intervals.size, 0);
  await f.pipeline.dispose();
});

test("replacing a call microphone immediately invalidates the monitor and keeps call tracks alive", async () => {
  const f = fixture();
  await f.session.start(options, () => {});
  const replacement = f.stream("replacement");
  f.pipeline.attachMicrophone(replacement);
  assert.equal(f.ended(), 1);
  assert.equal(f.elements[0].srcObject, null);
  assert.equal(f.intervals.size, 0);
  assert.equal(replacement.getAudioTracks()[0].readyState, "live");
  await f.pipeline.dispose();
});

test("ending the call invalidates monitoring and releases its output", async () => {
  const f = fixture();
  await f.session.start(options, () => {});
  await f.pipeline.dispose();
  assert.equal(f.ended(), 1);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.elements[0].srcObject, null);
});

test("outside calls, test owns one capture and stops input, DSP destination and context", async () => {
  const f = fixture();
  await f.pipeline.dispose();
  await f.session.start(options, () => {});
  assert.equal(f.captures.length, 1);
  assert.equal(f.session.borrowed, false);
  const context = f.contexts.at(-1);
  const output = f.elements[0].srcObject;
  for (const percent of [0, 50, 100, 200]) {
    f.session.setVolumes(percent, percent);
    assert.equal(f.elements[0].volume, Math.min(100, percent) / 100);
  }
  f.session.stop();
  f.session.stop();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.microphone.getAudioTracks()[0].readyState, "ended");
  assert.equal(output.getAudioTracks()[0].readyState, "ended");
  assert.equal(context.state, "closed");
  assert.equal(f.intervals.size, 0);
});

test("stopping during microphone permission releases late capture without ever playing", async () => {
  const pending = deferred();
  const f = fixture({ capture: () => pending.promise });
  await f.pipeline.dispose();
  const start = f.session.start(options, () => {});
  f.session.stop();
  pending.resolve(f.microphone);
  await start;
  assert.equal(f.microphone.getAudioTracks()[0].readyState, "ended");
  assert.equal(f.elements.length, 0);
});

test("a call starting while permission is pending is reused and the redundant capture is released", async () => {
  const pending = deferred();
  const f = fixture({ capture: () => pending.promise });
  await f.pipeline.dispose();
  const start = f.session.start(options, () => {});
  const call = new f.exports.MicrophoneAudioPipeline(() => {});
  const input = f.stream("new-call");
  call.attachMicrophone(input);
  pending.resolve(f.microphone);
  await start;
  assert.equal(f.session.borrowed, true);
  assert.equal(f.microphone.getAudioTracks()[0].readyState, "ended");
  f.session.stop();
  assert.equal(input.getAudioTracks()[0].readyState, "live");
  await call.dispose();
});

for (const phase of ["sink", "play"])
  test(`stop during pending ${phase} cannot resurrect microphone playback`, async () => {
    const pending = deferred();
    const f = fixture({ [phase]: () => pending.promise });
    const start = f.session.start(options, () => {});
    await Promise.resolve();
    f.session.stop();
    pending.resolve();
    await start;
    assert.equal(f.elements[0].srcObject, null);
    assert.equal(f.intervals.size, 0);
    assert.equal(f.pipeline.stream.getAudioTracks()[0].readyState, "live");
    await f.pipeline.dispose();
  });

test("sink rejection stops only monitor resources and exposes an error instead of silent fallback", async () => {
  const f = fixture({
    sink: () => {
      throw Error("sink denied");
    },
  });
  await assert.rejects(
    f.session.start(options, () => {}),
    /sink denied/,
  );
  assert.equal(f.elements[0].srcObject, null);
  assert.equal(f.intervals.size, 0);
  assert.equal(f.input.getAudioTracks()[0].readyState, "live");
  await f.pipeline.dispose();
});

test("speaker test honors selected output and 0/50/100%, and closing releases its context", async () => {
  const f = fixture();
  const speaker = new f.SpeakerTestSession();
  await speaker.start("speakers", 200);
  assert.equal(f.elements[0].sink, "speakers");
  assert.equal(f.elements[0].volume, 1);
  for (const percent of [0, 50, 100]) {
    speaker.setVolume(percent);
    assert.equal(f.elements[0].volume, percent / 100);
  }
  const output = f.elements[0].srcObject;
  speaker.stop();
  assert.equal(output.getAudioTracks()[0].readyState, "ended");
  assert.equal(f.elements[0].srcObject, null);
  assert.equal(f.contexts.at(-1).state, "closed");
  assert.equal(f.timeouts.size, 0);
  await f.pipeline.dispose();
});

test("speaker sink errors and a late sink result both clean up without fallback playback", async () => {
  for (const rejected of [false, true]) {
    const pending = deferred();
    const f = fixture({
      sink: () => (rejected ? Promise.reject(Error("sink rejected")) : pending.promise),
    });
    const speaker = new f.SpeakerTestSession();
    const start = speaker.start("custom", 50);
    if (rejected) await assert.rejects(start, /sink rejected/);
    else {
      speaker.stop();
      pending.resolve();
      await start;
    }
    assert.equal(f.elements[0].srcObject, null);
    assert.equal(f.elements[0].plays, 0);
    assert.equal(f.contexts.at(-1).state, "closed");
    await f.pipeline.dispose();
  }
});

test("explicit default refresh retains a stable sender, current mute and configured gain", async () => {
  const f = fixture();
  let captures = 0;
  const provider = loadVoiceProvider(f.exports, {
    navigator: {
      mediaDevices: {
        getUserMedia: async () => {
          captures++;
          return f.stream("system-default");
        },
      },
    },
  });
  provider.micStream = f.input;
  await provider.startSpeakingDetection();
  provider.setMuted(true);
  provider.setInputGain(50);
  const sender = provider.outgoingAudioTrack();
  await provider.setDevices({ microphoneId: null }, true);
  assert.equal(captures, 1);
  assert.equal(provider.outgoingAudioTrack(), sender);
  assert.equal(sender.enabled, false);
  assert.equal(provider.audioPipeline.gain.gain.value, 0.5);
  await provider.audioPipeline.dispose();
  await f.pipeline.dispose();
});

test("system output changes do not recapture the microphone; changing the default input does", async () => {
  const f = fixture();
  let captures = 0,
    group = "first";
  const provider = loadVoiceProvider(f.exports, {
    navigator: {
      mediaDevices: {
        enumerateDevices: async () => [
          { deviceId: "default", groupId: group, label: `Default ${group}`, kind: "audioinput" },
        ],
        getUserMedia: async () => {
          captures++;
          return f.stream("default-input");
        },
      },
    },
  });
  provider.micStream = f.input;
  await provider.startSpeakingDetection();
  provider.defaultMicrophoneSignature = "first:Default first";
  provider.refreshDefaultMicrophone();
  await new Promise((r) => setImmediate(r));
  assert.equal(captures, 0);
  group = "second";
  provider.refreshDefaultMicrophone();
  await new Promise((r) => setImmediate(r));
  assert.equal(captures, 1);
  provider.devices = { microphoneId: "explicit-headset" };
  group = "third";
  provider.refreshDefaultMicrophone();
  await new Promise((r) => setImmediate(r));
  assert.equal(captures, 1);
  await provider.audioPipeline.dispose();
  await f.pipeline.dispose();
});

function hookFixture() {
  let cursor = 0,
    pending = [],
    value;
  const slots = [],
    instances = [],
    listeners = new Set();
  const defaults = {
    inputDeviceId: null,
    outputDeviceId: null,
    inputVolume: 100,
    outputVolume: 100,
    noiseSuppression: "standard",
  };
  const context = {
    settings: defaults,
    sessionKey: "account-a",
    refreshDevices: async () => {},
    reportNoiseProcessing() {},
  };
  const memo = (fn, deps) => {
    const i = cursor++,
      old = slots[i];
    if (!old || deps.some((v, n) => !Object.is(v, old.deps[n]))) slots[i] = { deps, value: fn() };
    return slots[i].value;
  };
  const react = {
    useRef: (initial) => memo(() => ({ current: initial }), []),
    useCallback: (fn, deps) => memo(() => fn, deps),
    useState: (initial) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (next) => {
          slots[i] = next;
        },
      ];
    },
    useEffect: (fn, deps) => {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((v, n) => !Object.is(v, old.deps[n])))
        pending.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
    },
  };
  class Session {
    borrowed = true;
    stopped = false;
    pending = deferred();
    constructor() {
      instances.push(this);
    }
    start() {
      return this.pending.promise;
    }
    stop() {
      this.stopped = true;
    }
    setVolumes(input, output) {
      this.volumes = [input, output];
    }
    setVolume(output) {
      this.output = output;
    }
  }
  const { useMicrophoneTest } = load(
    "src/hooks/use-microphone-test.ts",
    {
      react,
      "./audio-settings-context": { useAudioSettings: () => context },
      "@/services/microphone-test": { MicrophoneTestSession: Session, SpeakerTestSession: Session },
    },
    {
      navigator: {
        mediaDevices: {
          addEventListener: (_name, fn) => listeners.add(fn),
          removeEventListener: (_name, fn) => listeners.delete(fn),
        },
      },
    },
  );
  const render = () => {
    cursor = 0;
    pending = [];
    value = useMicrophoneTest();
    pending.forEach((fn) => fn());
    return value;
  };
  render();
  return {
    context,
    instances,
    listeners,
    render,
    dispose: () => slots.forEach((slot) => slot?.cleanup?.()),
  };
}

for (const change of ["input", "output", "noise", "account", "devicechange", "close"])
  test(`microphone test is cancelled on ${change} and a pending start cannot reactivate it`, async () => {
    const f = hookFixture();
    const start = f.render().start();
    assert.equal(f.render().testing, true);
    const session = f.instances[0];
    if (change === "input") f.context.settings = { ...f.context.settings, inputDeviceId: "other" };
    if (change === "output")
      f.context.settings = { ...f.context.settings, outputDeviceId: "other" };
    if (change === "noise")
      f.context.settings = { ...f.context.settings, noiseSuppression: "advanced" };
    if (change === "account") f.context.sessionKey = "account-b";
    if (change === "devicechange") for (const fn of [...f.listeners]) fn();
    if (change === "close") f.dispose();
    else f.render();
    assert.equal(session.stopped, true);
    session.pending.resolve();
    await start;
    if (change !== "close") {
      assert.equal(f.render().testing, false);
      assert.equal(f.render().borrowed, false);
      f.dispose();
    }
    assert.equal(f.listeners.size, 0);
  });

test("volume updates while capture is pending are applied after start, without restarting the capture", async () => {
  const f = hookFixture();
  const start = f.render().start();
  const session = f.instances[0];
  f.context.settings = { ...f.context.settings, inputVolume: 0, outputVolume: 50 };
  f.render();
  session.pending.resolve();
  await start;
  assert.deepEqual(session.volumes, [0, 50]);
  assert.equal(session.stopped, false);
  assert.equal(f.instances.length, 1);
  f.dispose();
});

test("a volume change during permission is used before the first monitored sample is played", async () => {
  const pending = deferred();
  const f = fixture({ capture: () => pending.promise });
  await f.pipeline.dispose();
  const start = f.session.start(options, () => {});
  f.session.setVolumes(0, 0);
  pending.resolve(f.microphone);
  await start;
  assert.equal(f.elements[0].volume, 0);
  assert.equal(f.session.pipeline.gain.gain.value, 0);
  f.session.stop();
});
