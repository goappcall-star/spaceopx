import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("Screen viewing is isolated by account/room, resets after stop, and never stops media tracks", () => {
  let cursor = 0,
    effects = [];
  const slots = [];
  const voice = { activeChannelId: "room", remoteMedia: { other: { screen: {} } } },
    call = {
      groupConversationId: null,
      peer: { id: "peer" },
      status: "active",
      remote: { screen: {} },
      groupMedia: {},
    };
  let user = { id: "one" };
  const react = {
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    createContext: () => ({ Provider: "context" }),
    useContext: () => {},
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], (value) => (slots[i] = value)];
    },
    useEffect: (fn) => effects.push(fn),
  };
  const imports = {
    react,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }) },
    "@/hooks/use-auth": { useAuth: () => ({ user }) },
    "@/hooks/use-voice": { useVoice: () => voice },
    "@/hooks/use-call": { useCall: () => call },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/components/call/ScreenViewingProvider.tsx", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText,
    { exports, require: (name) => imports[name] },
  );
  const render = () => {
    cursor = 0;
    effects = [];
    const result = exports.ScreenViewingProvider({ children: null }).props.value;
    effects.forEach((fn) => fn());
    return result;
  };
  render().setVoicePaused(true);
  let state = render();
  assert.equal(state.voicePaused, true);
  assert.equal(state.callPaused, false);
  state.setCallPaused(true);
  assert.equal(render().callPaused, true);
  voice.activeChannelId = "different";
  assert.equal(render().voicePaused, false);
  user = { id: "two" };
  state = render();
  assert.equal(state.callPaused, false);
  assert.equal(state.voicePaused, false);
  state.setCallPaused(true);
  call.remote.screen = null;
  render();
  assert.equal(render().callPaused, false);
  assert.ok(voice.remoteMedia.other.screen);
});
