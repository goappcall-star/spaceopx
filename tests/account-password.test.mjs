import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { validPassword } from "../src/lib/input-validation.mjs";
function compile(file, imports, extra = {}) {
  const exports = {};
  const source = fs.readFileSync(file, "utf8").replaceAll("import.meta.env", "TEST_ENV");
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (id) => {
        assert.ok(id in imports, id);
        return imports[id];
      },
      ...extra,
    },
  );
  return exports;
}
const policy = compile("src/lib/account-password.ts", {
  "@/lib/input-validation.mjs": { validPassword },
});
const fields = {
  current: "old-test-password",
  next: "new-test-password",
  confirm: "new-test-password",
};
test("Password change validates confirmation, length and difference without trimming", () => {
  for (const change of [
    { confirm: "other" },
    { next: "short", confirm: "short" },
    { next: fields.current, confirm: fields.current },
    { current: "" },
    { next: "x".repeat(129) },
  ])
    assert.throws(() => policy.validatePasswordChange({ ...fields, ...change }));
  policy.validatePasswordChange({ ...fields, next: " new secret ", confirm: " new secret " });
});
function fixture({
  wrong = false,
  otherIdentity = false,
  switched = false,
  updateError = null,
  cleanupFails = false,
} = {}) {
  const updates = [],
    cleanups = [],
    options = [];
  let mainSignIns = 0;
  const verifier = {
    auth: {
      signInWithPassword: async (credentials) => {
        assert.equal(credentials.email, "fixture@example.invalid");
        assert.equal(credentials.password, fields.current);
        return wrong
          ? { data: {}, error: { code: "invalid_credentials" } }
          : { data: { user: { id: otherIdentity ? "other" : "alice" }, session: {} }, error: null };
      },
      signOut: async (opt) => {
        cleanups.push(opt);
        if (cleanupFails) throw Error("cleanup");
      },
    },
  };
  const primary = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "alice", email: "fixture@example.invalid" } },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { user: { id: switched ? "bob" : "alice" } } },
        error: null,
      }),
      updateUser: async (data) => {
        updates.push(data);
        return { error: updateError };
      },
      signInWithPassword: () => {
        mainSignIns++;
        throw Error("main session must not be replaced");
      },
    },
  };
  const api = compile(
    "src/services/account-password.ts",
    {
      "@supabase/supabase-js": {
        createClient: (url, key, opts) => {
          options.push(opts);
          return verifier;
        },
      },
      "@/integrations/supabase/client": { supabase: primary },
      "@/lib/supabase-key-policy.mjs": {
        assertSupabaseUrl: () => {},
        assertPublicSupabaseKey: () => {},
      },
      "@/lib/account-password": policy,
    },
    {
      TEST_ENV: {
        VITE_SUPABASE_URL: "https://fixture.invalid",
        VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
      },
      Headers,
      fetch: () => {
        throw Error("network forbidden");
      },
    },
  );
  return {
    ...api,
    updates,
    cleanups,
    options,
    get mainSignIns() {
      return mainSignIns;
    },
  };
}
test("Incorrect current password never reaches updateUser", async () => {
  const f = fixture({ wrong: true });
  await assert.rejects(f.changeAccountPassword(fields), (e) => e.code === "invalid_credentials");
  assert.equal(f.updates.length, 0);
  assert.equal(f.mainSignIns, 0);
});
test("Verified credentials update the authenticated account and revoke only the temporary local session", async () => {
  const f = fixture();
  await f.changeAccountPassword(fields);
  assert.deepEqual(JSON.parse(JSON.stringify(f.updates)), [
    { password: fields.next, current_password: fields.current },
  ]);
  assert.equal(f.options[0].auth.persistSession, false);
  assert.equal(f.options[0].auth.autoRefreshToken, false);
  assert.equal(f.options[0].auth.detectSessionInUrl, false);
  assert.equal(f.cleanups[0].scope, "local");
  assert.equal(f.mainSignIns, 0);
});
test("Identity mismatch and account switch stop before password mutation", async () => {
  for (const opts of [{ otherIdentity: true }, { switched: true }]) {
    const f = fixture(opts);
    await assert.rejects(f.changeAccountPassword(fields));
    assert.equal(f.updates.length, 0);
    assert.equal(f.cleanups.length, 1);
  }
});
test("Backend errors are preserved and temporary sessions are still revoked", async () => {
  const error = { code: "weak_password" },
    f = fixture({ updateError: error });
  await assert.rejects(f.changeAccountPassword(fields), (e) => e === error);
  assert.equal(f.cleanups.length, 1);
  assert.equal(policy.passwordChangeError(error).includes("forte"), true);
});
test("A cleanup failure cannot turn a completed password change into a false failure", async () => {
  await fixture({ cleanupFails: true }).changeAccountPassword(fields);
});
test("Error messages never echo authentication response bodies", () => {
  assert.equal(
    policy.passwordChangeError({ message: "sensitive response" }).includes("sensitive"),
    false,
  );
  assert.match(policy.passwordChangeError({ code: "invalid_credentials" }), /atual incorreta/);
});
