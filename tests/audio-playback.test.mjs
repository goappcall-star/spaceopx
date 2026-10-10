import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(componentName) {
  let cursor = 0,
    pending = [];
  const slots = [],
    sinks = [];
  const element = {
    srcObject: null,
    muted: false,
    volume: 1,
    paused: false,
    play: async () => {},
    pause() {
      this.paused = true;
    },
    setSinkId: async (id) => sinks.push(id),
  };
  const memo = (fn, deps) => {
    const i = cursor++,
      old = slots[i];
    if (!old || deps.some((d, n) => !Object.is(d, old.deps[n]))) slots[i] = { value: fn(), deps };
    return slots[i].value;
  };
  const react = {
    useRef: (initial) => memo(() => ({ current: initial }), []),
    useCallback: (fn, deps) => memo(() => fn, deps),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useEffect(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((d, n) => !Object.is(d, old.deps[n])))
        pending.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
    },
  };
  const jsx = (type, props) => {
    if (type === "audio") props.ref.current = element;
    return { type, props };
  };
  const imports = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@/components/ui/button": { Button: "button" },
    "@/hooks/use-audio-settings": {
      useAudioSettings: () => ({ settings: { outputVolume: 100, outputDeviceId: null } }),
    },
    "@/hooks/use-voice": {
      useVoice: () => ({
        remoteMedia: { alice: { audio: {} }, bob: { audio: {} } },
        volumes: {},
        deafened: false,
        restrictions: {},
        activeServerId: "server",
      }),
    },
    "@/lib/audio-volume": {
      receivedAudioVolume: (volume, _output, deafened) => (deafened ? 0 : volume / 100),
    },
  };
  const exports = {};
  const source =
    fs.readFileSync("src/components/voice/RemoteAudio.tsx", "utf8") + "\nexport { AudioSink };";
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      DOMException,
      require: (name) => {
        if (name === "@/services/voice-diagnostics")
          return { voiceDiagnostic: () => {}, voiceErrorName: (e) => e?.name ?? "Error" };
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  function render(props = {}) {
    cursor = 0;
    pending = [];
    const tree = exports[componentName](props);
    pending.forEach((fn) => fn());
    return tree;
  }
  return { render, element, sinks, dispose: () => slots.forEach((slot) => slot?.cleanup?.()) };
}
test("Returning remote audio to the default output actively resets its sink", async () => {
  const f = fixture("AudioSink");
  const props = {
    sinkId: "alice:0",
    stream: {},
    volume: 50,
    deafened: false,
    outputId: "headset",
    onBlocked() {},
    unlockToken: 0,
  };
  f.render(props);
  await Promise.resolve();
  f.render({ ...props, outputId: undefined });
  await Promise.resolve();
  assert.deepEqual(f.sinks, ["headset", ""]);
  assert.equal(f.element.volume, 0.5);
  f.dispose();
  assert.equal(f.element.srcObject, null);
  assert.equal(f.element.paused, true);
});
test("An unblocked participant cannot hide another participant's audio unlock button", () => {
  const f = fixture("RemoteAudio");
  const tree = f.render();
  const [alice, bob] = tree.props.children[0].props.children.filter(Boolean);
  alice.props.onBlocked("alice:0", true);
  bob.props.onBlocked("bob:0", false);
  assert.ok(f.render().props.children[1]);
  alice.props.onBlocked("alice:0", false);
  assert.equal(f.render().props.children[1], false);
});
