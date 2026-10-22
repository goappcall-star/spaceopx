import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function compile(relative, require = () => ({})) {
  const exports = {};
  const file = new URL(relative, import.meta.url);
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require, Intl, Date },
  );
  return exports;
}
const api = compile("../src/lib/account-settings.ts");
test("Login methods reflect linked identities, never email alone or guessed password state", () => {
  assert.equal(api.accountLoginMethods({ email: "test@example.invalid" })[0].connected, false);
  assert.equal(
    api.accountLoginMethods({ identities: [{ provider: "google" }] })[1].connected,
    true,
  );
  assert.equal(
    api.accountLoginMethods({ identities: [{ provider: "google" }] })[0].connected,
    false,
  );
  assert.equal(api.accountLoginMethods({ identities: [{ provider: "email" }] })[0].connected, true);
  assert.equal(
    api.accountLoginMethods(null).every((method) => !method.connected),
    true,
  );
  assert.equal(api.accountLoginMethods({ identities: [{ provider: "unknown" }] }).length, 2);
});
test("Account creation uses real timestamps and handles missing dates", () => {
  assert.equal(api.accountDate(undefined), "Não disponível");
  assert.equal(api.accountDate("invalid"), "Não disponível");
  assert.match(api.accountDate("2023-03-12T12:00:00Z"), /2023/);
});
const jsx = (type, props) => ({ type, props: props ?? {} });
const { AccountSettingsView } = compile(
  "../src/components/settings/AccountSettingsView.tsx",
  (name) => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
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
test("Account view only navigates to profile/privacy; destructive actions stay disabled and images cannot be edited", () => {
  let profile = 0,
    privacy = 0,
    signout = 0;
  const tree = AccountSettingsView({
    name: "Fixture",
    username: "fixture",
    email: "test@example.invalid",
    verified: true,
    created: "2023",
    methods: api.accountLoginMethods(null),
    platform: "WEB",
    online: false,
    expires: null,
    busy: false,
    onProfile: () => profile++,
    onPrivacy: () => privacy++,
    onSignOut: () => signout++,
  });
  const nodes = flatten(tree),
    buttons = nodes.filter((node) => node.type === "Button" || node.type === "button");
  assert.equal(
    nodes.some((node) => node.type === "input"),
    false,
  );
  assert.equal(
    buttons.some((button) => /avatar|banner|upload/i.test(text(button))),
    false,
  );
  for (const label of ["Desativar conta", "Excluir conta"]) {
    const button = buttons.find((item) => text(item) === label);
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.onClick, undefined);
  }
  buttons.find((button) => text(button).includes("Editar perfil")).props.onClick();
  buttons.find((button) => text(button).includes("Controle sua privacidade")).props.onClick();
  buttons.find((button) => text(button).includes("Sair da conta")).props.onClick();
  assert.deepEqual([profile, privacy, signout], [1, 1, 1]);
  assert.match(text(tree), /Senha e segurança ainda indisponível/);
  assert.match(text(tree), /Sem conexão de rede/);
});
