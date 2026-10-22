import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(file, imports, globals = {}) {
  let cursor = 0,
    dirty = false,
    pending = [],
    value;
  const slots = [];
  const memo = (fn, deps) => {
    const i = cursor++,
      old = slots[i];
    if (!old || deps.some((d, n) => !Object.is(d, old.deps[n]))) slots[i] = { value: fn(), deps };
    return slots[i].value;
  };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
          dirty = true;
        },
      ];
    },
    useRef: (initial) => memo(() => ({ current: initial }), []),
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
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
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (name === "react") return react;
        if (name === "react/jsx-runtime") return { jsx: (_type, props) => props };
        if (name === "./audio-settings-context" || name === "@/lib/audio-volume") {
          const local = {
            exports: {},
            require: (id) => {
              assert.equal(id, "react");
              return react;
            },
          };
          vm.runInNewContext(
            ts.transpileModule(
              fs.readFileSync(
                name === "./audio-settings-context"
                  ? "src/hooks/audio-settings-context.tsx"
                  : "src/lib/audio-volume.ts",
                "utf8",
              ),
              { compilerOptions: { module: ts.ModuleKind.CommonJS } },
            ).outputText,
            local,
          );
          return local.exports;
        }
        assert.ok(name in imports, name);
        return imports[name];
      },
      ...globals,
    },
  );
  const component = exports.AuthProvider ?? exports.AudioSettingsProvider;
  function render() {
    let count = 0;
    do {
      cursor = 0;
      dirty = false;
      pending = [];
      value = component({ children: null }).value;
      pending.forEach((fn) => fn());
      assert.ok(++count < 20);
    } while (dirty);
    return value;
  }
  async function flush() {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    return render();
  }
  render();
  return { render, flush, dispose: () => slots.forEach((slot) => slot?.cleanup?.()) };
}
function authFixture() {
  const pending = deferred();
  let listener;
  const f = fixture("src/hooks/use-auth.tsx", {
    "@tanstack/react-query": {
      useQueryClient: () => queryClient,
      useQuery: () => ({ data: null, refetch: async () => {} }),
    },
    "@/services/profiles": {},
    "@/integrations/supabase/client": {
      supabase: {
        auth: {
          getSession: () => pending.promise,
          onAuthStateChange(fn) {
            listener = fn;
            return { data: { subscription: { unsubscribe() {} } } };
          },
        },
      },
    },
  });
  return { ...f, pending, event: (...args) => listener(...args) };
}
const queryClient = { clear() {}, invalidateQueries: async () => {} };
test("A delayed initial session cannot undo a sign-out", async () => {
  const f = authFixture();
  f.event("SIGNED_OUT", null);
  f.pending.resolve({ data: { session: { user: { id: "old-user" } } } });
  await f.flush();
  assert.equal(f.render().session, null);
  assert.equal(f.render().loading, false);
  f.dispose();
});
test("A failed initial session read clears the login loading state", async () => {
  const f = authFixture();
  f.pending.reject(Error("storage unavailable"));
  await f.flush();
  assert.equal(f.render().loading, false);
  assert.equal(f.render().isAuthenticated, false);
  f.dispose();
});
test("Audio preferences ignore old account responses and cancel queued saves on logout", async () => {
  let user = { id: "first" };
  let hardware = { microphones: [], cameras: [], outputs: [] };
  const first = deferred(),
    second = deferred(),
    timers = new Map(),
    saved = [];
  const f = fixture(
    "src/hooks/use-audio-settings.tsx",
    {
      "@/hooks/use-auth": { useAuth: () => ({ user }) },
      "@/services/gamer": {
        preferencesService: {
          get: (id) => (id === "first" ? first.promise : second.promise),
          save: async (...args) => saved.push(args),
        },
      },
      "@/services/voice": {
        listMediaDevices: async () => hardware,
      },
      "@/services/noise-preference": { readNoiseMode: () => "standard", saveNoiseMode() {} },
      "@/services/call-sounds": { readCallSounds: () => true, saveCallSounds() {} },
    },
    {
      navigator: { mediaDevices: { addEventListener() {}, removeEventListener() {} } },
      window: {},
      HTMLMediaElement: function () {},
      setTimeout(fn) {
        const id = Symbol();
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  user = { id: "second" };
  f.render();
  first.resolve({ output_volume: 5 });
  await f.flush();
  assert.equal(f.render().loaded, false);
  second.resolve({
    output_volume: 180,
    input_volume: 200,
    input_device_id: "saved-mic",
    ptt_key: "KeyB",
    input_mode: "ptt",
  });
  await f.flush();
  assert.equal(f.render().settings.outputVolume, 100);
  assert.equal(f.render().settings.inputVolume, 100);
  assert.equal(f.render().settings.inputDeviceId, "saved-mic");
  assert.equal(f.render().settings.pttKey, "KeyB");
  assert.equal(f.render().settings.inputMode, "ptt");
  hardware = {
    microphones: [{ deviceId: "saved-mic", label: "Saved mic" }],
    cameras: [],
    outputs: [],
  };
  await f.render().refreshDevices();
  await f.flush();
  hardware = {
    microphones: [{ deviceId: "replacement", label: "Replacement mic" }],
    cameras: [],
    outputs: [],
  };
  await f.render().refreshDevices();
  await f.flush();
  assert.equal(f.render().settings.inputDeviceId, null);
  assert.equal(f.render().settings.pttKey, "KeyB");
  for (const percent of [0, 50, 100, 999, -50, NaN]) {
    f.render().update({ inputVolume: percent, outputVolume: percent });
    const state = f.render().settings;
    const expected = Number.isNaN(percent) ? 100 : Math.max(0, Math.min(100, percent));
    assert.equal(state.inputVolume, expected);
    assert.equal(state.outputVolume, expected);
    assert.equal(state.pttKey, "KeyB");
  }
  for (const fn of timers.values()) fn();
  assert.equal(saved.at(-1)[1].input_volume, 100);
  assert.equal(saved.at(-1)[1].output_volume, 100);
  saved.length = 0;
  f.render().update({ outputVolume: 30 });
  f.render();
  assert.equal(timers.size, 1);
  user = null;
  f.render();
  assert.equal(timers.size, 0);
  assert.equal(saved.length, 0);
  assert.equal(f.render().settings.outputVolume, 100);
  f.dispose();
});
