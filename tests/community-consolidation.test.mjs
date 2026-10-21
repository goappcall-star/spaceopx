import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
const root = path.resolve(new URL("..", import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ""));
function cosmeticsHarness(enabled = true) {
  const callbacks = new Set(),
    invalidations = [],
    reads = [],
    cleanups = [];
  const client = {
    getQueryCache: () => ({
      subscribe: (callback) => {
        callbacks.add(callback);
        return () => callbacks.delete(callback);
      },
    }),
    invalidateQueries: (...args) => {
      invalidations.push(args);
      return Promise.resolve();
    },
  };
  const source = fs.readFileSync(path.join(root, "src/hooks/use-community-cosmetics.ts"), "utf8");
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    {
      exports,
      require: (name) => {
        if (name === "react")
          return {
            useEffect: (callback) => {
              const cleanup = callback();
              if (cleanup) cleanups.push(cleanup);
            },
          };
        if (name === "@tanstack/react-query")
          return { useQueryClient: () => client, useQuery: (options) => options };
        if (name.endsWith("community-feature")) return { COMMUNITY_V1_ENABLED: enabled };
        if (name.endsWith("community-evolution"))
          return {
            communityEvolutionService: {
              cosmetics: (id) => {
                reads.push(id);
                return Promise.resolve();
              },
            },
          };
        throw Error("Unexpected dependency: " + name);
      },
    },
  );
  return {
    hook: exports.useCommunityCosmetics,
    invalidations,
    reads,
    callbacks,
    unmount: () => cleanups.forEach((fn) => fn()),
    invalidate: (key) =>
      callbacks.forEach((cb) =>
        cb({ type: "updated", action: { type: "invalidate" }, query: { queryKey: key } }),
      ),
  };
}
test("cosmetic access invalidation is scoped to the observed server and cleans up", async () => {
  const h = cosmeticsHarness();
  const q = h.hook("server-a", "account-a");
  await q.queryFn();
  assert.deepEqual(h.reads, ["server-a"]);
  h.invalidate(["roles", "server-b"]);
  h.invalidate(["community-events", "account-a", "server-a"]);
  assert.equal(h.invalidations.length, 0);
  h.invalidate(["members", "server-a"]);
  assert.equal(h.invalidations.length, 1);
  assert.deepEqual(Array.from(h.invalidations[0][0].queryKey), [
    "community-cosmetics",
    "account-a",
    "server-a",
  ]);
  assert.equal(h.invalidations[0][1].cancelRefetch, false);
  h.unmount();
  h.invalidate(["roles", "server-a"]);
  assert.equal(h.invalidations.length, 1);
  assert.equal(h.callbacks.size, 0);
});
test("cosmetic cache separates accounts and the default disabled flag adds no subscription", () => {
  const h = cosmeticsHarness();
  assert.notDeepEqual(
    Array.from(h.hook("server-a", "account-a").queryKey),
    Array.from(h.hook("server-a", "account-b").queryKey),
  );
  h.unmount();
  const off = cosmeticsHarness(false);
  assert.equal(off.hook("server-a", "account-a").enabled, false);
  assert.equal(off.callbacks.size, 0);
});
test("unified preview dependency graph cannot load live Supabase or service modules", () => {
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const imports = [...js.matchAll(/(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    for (const spec of imports) {
      assert.ok(
        !/supabase|^@\/services\//.test(spec),
        "Live backend dependency in " + path.relative(root, file) + ": " + spec,
      );
      if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
      const base = spec.startsWith("@/")
        ? path.join(root, "src", spec.slice(2))
        : path.resolve(path.dirname(file), spec);
      const resolved = [
        base,
        base + ".tsx",
        base + ".ts",
        base + ".mjs",
        path.join(base, "index.ts"),
      ].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      assert.ok(resolved, "Unresolved preview dependency: " + spec);
      if (/\.(tsx?|mjs)$/.test(resolved)) visit(resolved);
    }
  }
  visit(path.join(root, "tests/community-unified-preview/entry.tsx"));
  assert.ok(visited.size > 15, "Expected real component graph, not a standalone mock");
});
