import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(relative, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL(relative, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, ...globals },
  );
  return exports;
}
const model = load("../src/lib/accessibility.ts");
test("Accessibility normalizes stored data and preserves system reduced motion", () => {
  const result = model.normalizeAccessibility({
    text: "injected",
    contrast: "true",
    keyboard: true,
    reducedMotion: false,
    unknown: "ignored",
  });
  assert.equal(result.text, "normal");
  assert.equal(result.contrast, false);
  assert.equal(result.keyboard, true);
  assert.equal("unknown" in result, false);
  assert.equal(model.accessibilityAttributes(result, true)["data-a11y-motion"], "true");
  assert.equal(model.accessibilityAttributes(result, false)["data-a11y-motion"], "false");
  assert.equal(model.normalizeAccessibility(null).text, "normal");
});
function runtime() {
  const values = new Map(),
    attrs = new Map(),
    events = new Map(),
    mediaEvents = new Map(),
    effects = [];
  const media = {
    matches: false,
    addEventListener: (name, fn) => mediaEvents.set(name, fn),
    removeEventListener: (name) => mediaEvents.delete(name),
  };
  const state = { blocked: false };
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (state.blocked) throw Error("blocked");
      values.set(key, value);
    },
  };
  const hooks = load("../src/hooks/use-accessibility.ts", {
    localStorage: storage,
    matchMedia: () => media,
    window: {
      addEventListener: (name, fn) => events.set(name, fn),
      removeEventListener: (name) => events.delete(name),
    },
    document: { documentElement: { setAttribute: (key, value) => attrs.set(key, value) } },
    require: (name) =>
      name === "react"
        ? { useEffect: (fn) => effects.push(fn), useSyncExternalStore: (_, snapshot) => snapshot() }
        : name === "@/lib/accessibility"
          ? model
          : { jsx: () => null, jsxs: () => null },
  });
  return { hooks, values, attrs, events, media, mediaEvents, effects, state };
}
test("Accessibility persists independently from appearance/audio; blocked storage retains session settings", () => {
  const r = runtime();
  const cleanup = r.hooks.startAccessibilitySync();
  r.hooks.setAccessibility({
    text: "large",
    contrast: true,
    keyboard: true,
    focus: true,
    reducedTransparency: true,
  });
  assert.equal(r.attrs.get("data-a11y-text"), "large");
  assert.equal(r.attrs.get("data-a11y-contrast"), "true");
  assert.equal(JSON.parse(r.values.get(model.ACCESSIBILITY_KEY)).focus, true);
  assert.equal(r.values.size, 1);
  r.state.blocked = true;
  r.hooks.setAccessibility({ text: "compact" });
  assert.equal(r.hooks.useAccessibilityStorage(), false);
  assert.equal(r.hooks.useAccessibility().text, "compact");
  r.media.matches = true;
  r.mediaEvents.get("change")();
  assert.equal(r.hooks.useAccessibilityReducedMotion(), true);
  r.hooks.setAccessibility({ reducedMotion: false });
  assert.equal(r.attrs.get("data-a11y-motion"), "true");
  cleanup();
  assert.equal(r.events.size, 0);
  assert.equal(r.mediaEvents.size, 0);
});
test("Cross-window updates and clearing preferences restore defaults without changing visual quality", () => {
  const r = runtime();
  r.hooks.startAccessibilitySync();
  r.values.set(model.ACCESSIBILITY_KEY, JSON.stringify({ text: "large", reducedMotion: true }));
  r.events.get("storage")({ key: model.ACCESSIBILITY_KEY });
  assert.equal(r.hooks.useAccessibilityReducedMotion(), true);
  r.values.clear();
  r.events.get("storage")({ key: null });
  assert.equal(r.hooks.useAccessibility().text, "normal");
  assert.equal(r.attrs.get("data-a11y-motion"), "false");
  assert.equal(r.attrs.has("data-visual-quality"), false);
});
test("Accessibility view exposes exactly six comfort settings and no cosmetic controls", () => {
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const { AccessibilitySettingsView } = load(
    "../src/components/settings/AccessibilitySettingsView.tsx",
    {
      require: (name) =>
        name === "react/jsx-runtime" ? { jsx, jsxs: jsx } : new Proxy({}, { get: (_, key) => key }),
    },
  );
  const changes = [];
  const tree = AccessibilitySettingsView({
    preferences: model.DEFAULT_ACCESSIBILITY,
    systemReduced: true,
    onChange: (value) => changes.push(value),
  });
  function flatten(node) {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    return [node, ...flatten(node.props?.children)];
  }
  const nodes = flatten(tree),
    toggles = nodes.filter((node) => node.type === "Switch");
  assert.equal(nodes.filter((node) => node.type === "h2").length, 6);
  assert.equal(toggles.length, 5);
  assert.equal(
    toggles.some((node) => /glow|moldura/i.test(node.props["aria-label"])),
    false,
  );
  toggles
    .find((node) => node.props["aria-label"] === "Contraste elevado")
    .props.onCheckedChange(true);
  assert.equal(changes[0].contrast, true);
  const size = nodes.find(
    (node) => node.type === "button" && node.props.children[1] === "Ampliado",
  );
  size.props.onClick();
  assert.equal(changes[1].text, "large");
});
test("Reduced motion pauses animated images without changing the selected performance level", () => {
  let reduced = false;
  const saved = new Map();
  const quality = load("../src/hooks/use-visual-quality.ts", {
    window: {},
    document: { documentElement: { dataset: {} } },
    matchMedia: () => ({ matches: false }),
    localStorage: { setItem: (key, value) => saved.set(key, value) },
    require: (name) =>
      name === "react"
        ? { useSyncExternalStore: (_, snapshot) => snapshot() }
        : name === "@/hooks/use-accessibility"
          ? { useAccessibilityReducedMotion: () => reduced }
          : load("../src/lib/visual-quality.ts"),
  });
  assert.equal(quality.useMediaAnimations(), true);
  reduced = true;
  assert.equal(quality.useMediaAnimations(), false);
  assert.equal(quality.useVisualQuality(), "normal");
  assert.equal(saved.size, 0);
  reduced = false;
  quality.setVisualQuality("optimized");
  assert.equal(quality.useMediaAnimations(), false);
});
