import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(relative, require = () => ({})) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL(relative, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    { exports, require },
  );
  return exports;
}
const model = load("../src/lib/appearance-settings.ts");
test("Performance preview suppresses effects without rewriting saved customization", () => {
  const prefs = { ...model.APPEARANCE_DEFAULTS },
    before = JSON.stringify(prefs);
  const optimized = model.appearancePreviewPolicy(prefs, "optimized", false);
  assert.equal(optimized.glow, false);
  assert.equal(optimized.frames, false);
  assert.equal(optimized.animations, true);
  const maximum = model.appearancePreviewPolicy(prefs, "maximum", false);
  assert.equal(maximum.animations, false);
  const normal = model.appearancePreviewPolicy(prefs, "normal", false);
  assert.equal(normal.glow, true);
  assert.equal(normal.frames, true);
  assert.equal(JSON.stringify(prefs), before);
});
test("Saved transparency, reduced motion and all supported accents have truthful previews", () => {
  for (const [level, alpha] of [
    ["none", 1],
    ["low", 0.94],
    ["medium", 0.82],
    ["high", 0.66],
  ])
    assert.equal(
      model.appearancePreviewPolicy(
        { ...model.APPEARANCE_DEFAULTS, transparency_level: level },
        "normal",
        false,
      ).alpha,
      alpha,
    );
  const reduced = model.appearancePreviewPolicy(model.APPEARANCE_DEFAULTS, "normal", true);
  assert.equal(reduced.animations, false);
  assert.equal(reduced.frames, false);
  assert.equal(
    model.appearancePreviewPolicy(
      { ...model.APPEARANCE_DEFAULTS, animations_enabled: false },
      "normal",
      false,
    ).frames,
    false,
  );
  for (const accent of model.APPEARANCE_ACCENTS)
    assert.equal(
      model.appearancePreviewPolicy(
        { ...model.APPEARANCE_DEFAULTS, accent_color: accent.value },
        "normal",
        false,
      ).accent,
      accent.color,
    );
  assert.deepEqual(Array.from(model.APPEARANCE_QUALITIES, (q) => q.value).sort(), [
    "maximum",
    "normal",
    "optimized",
  ]);
});
const jsx = (type, props) => ({ type, props: props ?? {} });
const { AppearanceSettingsView } = load(
  "../src/components/settings/AppearanceSettingsView.tsx",
  (name) => {
    if (name === "react") return { useState: (value) => [value, () => {}] };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "@/lib/appearance-settings") return model;
    return new Proxy({}, { get: (_, key) => key });
  },
);
function flatten(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...flatten(node.props?.children)];
}
function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
test("Appearance controls retain existing enum values; density is explicitly unavailable and demos cannot start calls", () => {
  const updates = [],
    themes = [],
    qualities = [];
  const tree = AppearanceSettingsView({
    preferences: model.APPEARANCE_DEFAULTS,
    theme: "dark",
    effectiveTheme: "dark",
    quality: "normal",
    reducedMotion: false,
    onPreference: (v) => updates.push(v),
    onTheme: (v) => themes.push(v),
    onQuality: (v) => qualities.push(v),
  });
  const nodes = flatten(tree),
    buttons = nodes.filter((node) => node.type === "button");
  buttons.find((button) => text(button) === "Automático").props.onClick();
  buttons.find((button) => button.props["aria-label"] === "Roxo").props.onClick();
  nodes
    .find((node) => node.type === "Switch" && node.props["aria-label"] === "Modo Desempenho")
    .props.onCheckedChange(true);
  nodes
    .find((node) => node.type === "Switch" && node.props["aria-label"] === "Modo Desempenho")
    .props.onCheckedChange(false);
  assert.deepEqual(themes, ["system"]);
  assert.equal(updates[0].accent_color, "neon_purple");
  assert.deepEqual(qualities, ["optimized", "normal"]);
  const density = nodes.find((node) => node.props?.className?.includes("appearance-density"));
  assert.equal(
    flatten(density)
      .filter((node) => node.type === "button")
      .every((node) => node.props.disabled === true && !node.props.onClick),
    true,
  );
  assert.match(text(tree), /Densidade ajustável ainda indisponível/);
  assert.equal(
    nodes.some((node) => ["audio", "video", "iframe"].includes(node.type)),
    false,
  );
  assert.equal(
    nodes.find((node) => node.type === "input" && node.props.type === "range").props.max,
    100,
  );
});
