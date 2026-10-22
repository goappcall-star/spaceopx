import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const compile = (file, module) =>
  ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const lib = await import(
  "data:text/javascript;base64," +
    Buffer.from(compile("../src/lib/server-access.ts", ts.ModuleKind.ESNext)).toString("base64")
);
const draft = {
  name: " Meu squad ",
  description: " Olá ",
  theme: "gaming",
  visibility: "private",
  iconFile: null,
};
test("server setup validates bounded fields and preserves real theme/visibility choices", () => {
  assert.equal(lib.validateServerSetup(draft).name, "Meu squad");
  for (const patch of [
    { name: "a" },
    { name: "a".repeat(61) },
    { description: "x".repeat(201) },
    { theme: "admin" },
    { visibility: "anyone" },
    { name: "bad\u0001name" },
  ])
    assert.throws(() => lib.validateServerSetup({ ...draft, ...patch }));
  assert.equal(
    lib.validateServerSetup({ ...draft, theme: "art", visibility: "public" }).theme,
    "art",
  );
  assert.equal(lib.validateServerIcon({ type: "image/png", size: 4 * 1024 * 1024 }), null);
  assert.ok(lib.validateServerIcon({ type: "image/svg+xml", size: 10 }));
  assert.ok(lib.validateServerIcon({ type: "image/png", size: 4 * 1024 * 1024 + 1 }));
});
test("invite entry accepts raw codes, HTTPS links and desktop links without navigating to them", () => {
  for (const value of [
    " DEMO_123 ",
    "https://lobbyx-nine.vercel.app/invite/DEMO_123?source=test",
    "lobbyx://invite/DEMO_123",
  ])
    assert.equal(lib.extractServerInviteCode(value), "demo_123");
  for (const value of [
    "",
    "https://example.test/other/demo",
    "https://user:password@example.test/invite/demo",
    "javascript:alert(1)",
    "abc def",
    "x".repeat(129),
  ])
    assert.throws(() => lib.extractServerInviteCode(value));
});
test("server service keeps legacy RPC compatibility and saves new options in a single RPC", async () => {
  const calls = [],
    module = { exports: {} };
  const validation = { boundedText: (s) => s.trim(), safeImageUrl: (s) => s || null };
  const supabase = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: "new-server", error: null };
    },
  };
  vm.runInNewContext(compile("../src/services/servers.ts", ts.ModuleKind.CommonJS), {
    exports: module.exports,
    module,
    require: (name) => {
      if (name.includes("supabase/client")) return { supabase };
      if (name.includes("input-validation")) return validation;
      if (name.endsWith("server-access")) return lib;
      throw Error(name);
    },
  });
  await module.exports.serversService.create({ name: "Legacy" });
  await module.exports.serversService.create({
    name: "Modern",
    description: "Short",
    theme: "study",
    visibility: "public",
  });
  assert.equal(calls[0].name, "create_server");
  assert.equal(calls[1].name, "create_server_with_options");
  assert.equal(calls[1].args._theme, "study");
  assert.equal(calls[1].args._visibility, "public");
  await assert.rejects(module.exports.serversService.create({ name: "Bad", theme: "invalid" }));
  assert.equal(calls.length, 2);
});
