import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import ts from "typescript";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}
function harness(relative, name) {
  const slots = [];
  let cursor = 0;
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const pureCache = new Map();
  function pure(file) {
    if (pureCache.has(file)) return pureCache.get(file);
    const m = { exports: {} };
    pureCache.set(file, m.exports);
    vm.runInNewContext(transpile(file), {
      exports: m.exports,
      module: m,
      Date,
      Intl,
      URL,
      console,
      require: (spec) =>
        pure(path.resolve(path.dirname(file), spec.endsWith(".ts") ? spec : spec + ".ts")),
    });
    return m.exports;
  }
  function requireModule(spec) {
    if (spec === "react")
      return {
        useState: (initial) => {
          const i = cursor++;
          if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
          return [
            slots[i],
            (value) => {
              slots[i] = typeof value === "function" ? value(slots[i]) : value;
            },
          ];
        },
        useId: () => "test-action-group",
        useEffect: () => {},
        useRef: () => ({ current: null }),
      };
    if (spec === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    if (spec === "lucide-react") return new Proxy({}, { get: (_, key) => key });
    if (spec === "sonner") return { toast: { error: () => {} } };
    if (spec === "@/lib/utils") return { cn: (...values) => values.filter(Boolean).join(" ") };
    if (spec.startsWith("@/lib/"))
      return pure(path.join(root, "src/lib", spec.slice("@/lib/".length) + ".ts"));
    if (spec.endsWith(".css")) return {};
    return new Proxy({}, { get: (_, key) => key });
  }
  vm.runInNewContext(transpile(path.join(root, relative)), {
    exports: module.exports,
    module,
    require: requireModule,
    crypto: { randomUUID },
    Date,
    Intl,
    URL,
    console,
  });
  let props, tree;
  return {
    render(next = props) {
      props = next;
      cursor = 0;
      tree = module.exports[name](props);
      return tree;
    },
    nodes() {
      const out = [];
      function visit(n) {
        if (Array.isArray(n)) {
          n.forEach(visit);
          return;
        }
        if (!n || typeof n !== "object") return;
        out.push(n);
        visit(n.props?.children);
      }
      visit(tree);
      return out;
    },
    byId(id) {
      return this.nodes().find((n) => n.props.id === id);
    },
    text(n) {
      const t = n?.props?.children;
      if (Array.isArray(t))
        return t.map((x) => (typeof x === "object" ? this.text(x) : String(x ?? ""))).join("");
      return typeof t === "object" ? this.text(t) : String(t ?? "");
    },
    button(label) {
      return this.nodes().find((n) => n.type === "Button" && this.text(n) === label);
    },
  };
}
const sid = "ca000000-0000-0000-0000-000000000001",
  cid = "ca000000-0000-0000-0000-000000000002";
const channels = [{ id: cid, name: "Squad", type: "voice" }];
const initial = {
  id: "ca000000-0000-0000-0000-000000000003",
  server_id: sid,
  title: "Evento original",
  description: "Descrição",
  cover_url: null,
  channel_id: cid,
  starts_at: "2026-11-01T05:30:00.123Z",
  ends_at: null,
  timezone: "America/New_York",
  revision: 7,
};
function change(h, id, value) {
  h.byId(id).props.onChange({ target: { value } });
  h.render();
}
function submit(h) {
  h.nodes()
    .find((n) => n.type === "form")
    .props.onSubmit({ preventDefault() {} });
}

test("event file picker uploads on save and reuses a successful upload after an RPC failure", async () => {
  const h = harness("src/components/community/CommunityEventEditor.tsx", "CommunityEventEditor");
  const uploads = [],
    saves = [];
  const file = { size: 20, type: "image/png", name: "capa.png" };
  h.render({
    initial,
    channels,
    conflict: false,
    onClose() {},
    onUpload: async (f) => {
      uploads.push(f);
      return "https://assets.example.test/cover.png";
    },
    onSave: async (...args) => {
      saves.push(args);
      if (saves.length === 1) throw Error("Falha ao salvar");
    },
  });
  assert.equal(h.byId("event-cover").props.type, "file");
  h.byId("event-cover").props.onChange({ target: { files: [file], value: "capa.png" } });
  h.render();
  assert.equal(uploads.length, 0);
  submit(h);
  await new Promise((resolve) => setImmediate(resolve));
  h.render();
  assert.equal(saves[0][1].cover_url, "https://assets.example.test/cover.png");
  assert.equal(saves[0][2], 7);
  submit(h);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(uploads.length, 1);
  assert.equal(saves.length, 2);
});

test("event file selection is local until save and cannot fake an upload in an offline preview", async () => {
  const h = harness("src/components/community/CommunityEventEditor.tsx", "CommunityEventEditor");
  let saves = 0;
  h.render({ initial, channels, conflict: false, onClose() {}, onSave: async () => saves++ });
  h.byId("event-cover").props.onChange({
    target: { files: [{ size: 20, type: "image/jpeg", name: "capa.jpeg" }], value: "capa.jpeg" },
  });
  h.render();
  assert.equal(h.button("Salvar alterações").props.disabled, true);
  submit(h);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saves, 0);
});
test("redesigned event editor preserves revision, IANA zone and exact unchanged ambiguous instant", async () => {
  const h = harness("src/components/community/CommunityEventEditor.tsx", "CommunityEventEditor"),
    saved = [];
  h.render({
    initial,
    channels,
    conflict: false,
    onSave: async (...args) => saved.push(args),
    onClose() {},
  });
  change(h, "event-title", "Evento revisado");
  submit(h);
  await Promise.resolve();
  assert.equal(saved.length, 1);
  assert.equal(saved[0][2], 7);
  assert.equal(saved[0][1].starts_at, initial.starts_at);
  assert.equal(saved[0][1].timezone, initial.timezone);
  assert.equal(saved[0][1].title, "Evento revisado");
});
test("redesigned event requires an explicit occurrence after changing an ambiguous local time", async () => {
  const h = harness("src/components/community/CommunityEventEditor.tsx", "CommunityEventEditor"),
    saved = [];
  h.render({
    initial: null,
    channels,
    conflict: false,
    onSave: async (...args) => saved.push(args),
    onClose() {},
  });
  change(h, "event-title", "Encontro");
  change(h, "event-channel", cid);
  change(h, "event-zone", "America/New_York");
  change(h, "event-start", "2026-11-01T01:30");
  assert.equal(h.button("Criar evento").props.disabled, true);
  submit(h);
  await Promise.resolve();
  assert.equal(saved.length, 0);
  change(h, "event-start-occurrence", "2026-11-01T06:30:00.000Z");
  submit(h);
  await Promise.resolve();
  assert.equal(saved.length, 1);
  assert.equal(saved[0][1].starts_at, "2026-11-01T06:30:00.000Z");
});
test("event revision conflict prevents saving even when a valid draft already exists", () => {
  const h = harness("src/components/community/CommunityEventEditor.tsx", "CommunityEventEditor");
  let calls = 0;
  h.render({ initial, channels, conflict: true, onSave: async () => calls++, onClose() {} });
  submit(h);
  assert.equal(calls, 0);
  assert.equal(h.button("Salvar alterações").props.disabled, true);
});
test("sanction confirmation resets when target, action or reason changes", () => {
  const h = harness("src/components/community/ModerationViews.tsx", "MemberActionForm");
  h.render({
    members: [{ id: "member", name: "Pessoa" }],
    busy: false,
    canWarn: true,
    canSanction: true,
    onAction() {},
  });
  const target = h.nodes().find((n) => n.type === "select");
  target.props.onChange({ target: { value: "member" } });
  h.render();
  const radios = h.nodes().filter((n) => n.props.type === "radio");
  radios[2].props.onChange();
  h.render();
  h.nodes()
    .find((n) => n.type === "textarea")
    .props.onChange({ target: { value: "Motivo registrado" } });
  h.render();
  h.nodes()
    .find((n) => n.props.type === "checkbox")
    .props.onChange({ target: { checked: true } });
  h.render();
  assert.equal(h.button("Confirmar banimento").props.disabled, false);
  h.nodes()
    .find((n) => n.type === "textarea")
    .props.onChange({ target: { value: "Outro motivo" } });
  h.render();
  assert.equal(h.button("Confirmar banimento").props.disabled, true);
});
test("cover previews refuse HTTP/data images and recover after a failed URL is replaced", () => {
  const h = harness("src/components/community/CommunityUI.tsx", "CommunityCover");
  h.render({ src: "http://example.test/cover.png", title: "Capa" });
  assert.equal(h.nodes().filter((n) => n.type === "img").length, 0);
  h.render({ src: "data:image/png;base64,AAAA", title: "Capa" });
  assert.equal(h.nodes().filter((n) => n.type === "img").length, 0);
  h.render({ src: "https://user:password@example.test/cover.png", title: "Capa" });
  assert.equal(h.nodes().filter((n) => n.type === "img").length, 0);
  h.render({ src: "//example.test/cover.png", title: "Capa" });
  assert.equal(h.nodes().filter((n) => n.type === "img").length, 0);
  h.render({ src: "https://example.test/cover.png", title: "Capa" });
  h.nodes()
    .find((n) => n.type === "img")
    .props.onError();
  h.render();
  assert.equal(h.nodes().filter((n) => n.type === "img").length, 0);
  h.render({ src: "https://example.test/new.png", title: "Capa" });
  assert.equal(h.nodes().find((n) => n.type === "img").props.referrerPolicy, "no-referrer");
});
test("locked cosmetics keep Apply disabled after visual redesign", () => {
  const h = harness(
    "src/components/community/CommunityEvolutionViews.tsx",
    "CommunityCosmeticsView",
  );
  h.render({
    data: {
      can_manage: true,
      selection: {},
      equipped: {},
      items: [
        {
          id: "lx_orbit_frame",
          name: "Moldura",
          description: "Fonte desligada",
          slot: "frame",
          render_key: "orbit_frame",
          available: false,
          owned: true,
          requires_mission: true,
        },
      ],
    },
    preview: {},
    onPreview() {},
    onEquip() {},
    busy: false,
  });
  assert.equal(h.button("Aplicar").props.disabled, true);
});
test("discovery preview edits never publish and consent is reset when editing an existing listing", () => {
  const h = harness("src/components/community/DiscoverySettingsForm.tsx", "DiscoverySettingsForm");
  let calls = 0;
  h.render({
    data: {
      is_owner: true,
      listing: {
        name: "Squad",
        description: "Comunidade de teste com descrição suficiente.",
        category: "gaming",
        language: "pt-br",
        interests: [],
        public_rules: ["Respeito"],
        admission: "approval",
        status: "unlisted",
        revision: 1,
        consent: true,
      },
    },
    serverName: "Squad",
    busy: false,
    error: null,
    onSave() {
      calls++;
    },
  });
  assert.equal(h.button("Solicitar publicação no diretório").props.disabled, true);
  const title = h.nodes().find((n) => n.type === "input" && n.props.maxLength === 100);
  title.props.onChange({ target: { value: "Novo nome" } });
  h.render();
  assert.equal(calls, 0);
  assert.equal(h.button("Solicitar publicação no diretório").props.disabled, true);
});

test("unified preview fixture satisfies the real Home validator before editing", () => {
  const lib = { exports: {} };
  vm.runInNewContext(transpile(path.join(root, "src/lib/community-experience.ts")), {
    module: lib,
    exports: lib.exports,
    structuredClone,
    URL,
  });
  const source = fs.readFileSync(
    path.join(root, "tests/community-unified-preview/preview.tsx"),
    "utf8",
  );
  const declarations = source.slice(
    source.indexOf("const sid ="),
    source.indexOf("function Session()"),
  );
  const context = { DEFAULT_EXPERIENCE: lib.exports.DEFAULT_EXPERIENCE, Date, fixture: null };
  vm.runInNewContext(
    ts.transpileModule(declarations + "\nfixture = initial;", {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText,
    context,
  );
  assert.doesNotThrow(() => lib.exports.validateExperience(context.fixture.experience));
});

test("embedded previews do not reinsert global utility styles after responsive preview rules", () => {
  for (const name of ["events", "discovery", "moderation", "evolution"]) {
    const directory = path.join(root, "tests/community-" + name + "-preview");
    assert.doesNotMatch(
      fs.readFileSync(path.join(directory, "preview.tsx"), "utf8"),
      /import\s+["'][^"']*styles\.css["']/,
    );
    assert.doesNotMatch(
      fs.readFileSync(path.join(directory, "preview.tsx"), "utf8"),
      /root\.unmount/,
    );
    assert.match(
      fs.readFileSync(path.join(directory, "entry.tsx"), "utf8"),
      /import\s+["'][^"']*styles\.css["']/,
    );
  }
});
