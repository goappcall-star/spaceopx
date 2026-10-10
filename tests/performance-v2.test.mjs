import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as validation from "../src/lib/input-validation.mjs";
import { QueryClient } from "@tanstack/react-query";

function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL("../src/" + file, import.meta.url), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    {
      exports,
      require(name) {
        if (name === "@/lib/input-validation.mjs") return validation;
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  return exports;
}
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test("Profile cache is shared between route guard and AuthProvider; auth is still verified on each navigation", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let profileCalls = 0,
    authCalls = 0,
    profileOptions;
  const profilesService = {
    async getById(id) {
      profileCalls++;
      return { id };
    },
  };
  const supabase = {
    auth: {
      async getUser() {
        authCalls++;
        return { data: { user: { id: "alice" } } };
      },
    },
  };
  const imports = {
    "@/integrations/supabase/client": { supabase },
    "@/services/profiles": { profilesService },
    "@/hooks/use-auth": { useAuth() {} },
    "@/hooks/use-global-presence": { GlobalPresenceProvider() {} },
    "@/components/call/SessionCommunications": { SessionCommunications() {} },
    "react/jsx-runtime": {
      jsx() {
        return null;
      },
    },
    "@tanstack/react-router": {
      createFileRoute() {
        return (opts) => opts;
      },
      redirect(opts) {
        return Error(JSON.stringify(opts));
      },
    },
  };
  const { Route } = load("routes/_authenticated/route.tsx", imports);
  await Route.beforeLoad({ location: { href: "/app" }, context: { queryClient } });
  const react = {
    createContext() {
      return { Provider: "provider" };
    },
    useState(initial) {
      return [initial === null ? { user: { id: "alice" } } : initial, () => {}];
    },
    useEffect() {},
    useMemo(fn) {
      return fn();
    },
  };
  const { AuthProvider } = load("hooks/use-auth.tsx", {
    ...imports,
    react,
    "@tanstack/react-query": {
      useQueryClient() {
        return queryClient;
      },
      useQuery(opts) {
        profileOptions = opts;
        return { refetch: async () => {} };
      },
    },
  });
  AuthProvider({ children: null });
  await queryClient.fetchQuery(profileOptions);
  await Route.beforeLoad({ location: { href: "/app" }, context: { queryClient } });
  assert.equal(profileCalls, 1);
  assert.equal(authCalls, 2);
  await queryClient.invalidateQueries({ queryKey: ["profile", "alice"] });
  await queryClient.fetchQuery(profileOptions);
  assert.equal(profileCalls, 2);
  queryClient.clear();
});

for (const kind of ["server", "private"])
  test(`${kind}: hydration starts independent requests together and preserves authors, replies and own reactions`, async () => {
    const requests = [],
      author = deferred(),
      replies = deferred(),
      reactions = deferred();
    const field = kind === "server" ? "author_id" : "sender_id",
      table = kind === "server" ? "messages" : "direct_messages";
    const row = {
      id: "message",
      [field]: "alice",
      content: "Hi",
      reply_to_id: "reply",
      attachments: [],
      mentions: [],
    };
    const supabase = {
      from(name) {
        return {
          select() {
            return {
              in() {
                requests.push(name);
                return name === table ? replies.promise : reactions.promise;
              },
            };
          },
        };
      },
    };
    const profile = { id: "alice", display_name: "Alice" };
    const imports = {
      "@/integrations/supabase/client": { supabase },
      "@/services/profiles": {
        profilesService: {
          listByIds(ids) {
            if (!ids.length) return Promise.resolve([]);
            requests.push("profiles");
            return author.promise;
          },
        },
      },
    };
    if (kind === "private") {
      imports["@/services/messages"] = load("services/messages.ts", imports);
      imports["@/services/uploads"] = { validateFile() {} };
    }
    const module = load(kind === "server" ? "services/messages.ts" : "services/social.ts", imports);
    const service = kind === "server" ? module.messagesService : module.directMessagesService;
    const pending = service.hydrate([row], "me");
    assert.deepEqual(requests, [
      "profiles",
      table,
      kind === "server" ? "message_reactions" : "direct_message_reactions",
    ]);
    author.resolve([profile]);
    replies.resolve({ data: [{ id: "reply", [field]: "alice", content: "Previous" }] });
    reactions.resolve({ data: [{ message_id: "message", user_id: "me", emoji: "👍" }] });
    const [result] = await pending;
    assert.equal(result.author.id, "alice");
    assert.equal(result.replyTo.content, "Previous");
    assert.equal(result.replyTo.author.id, "alice");
    assert.equal(result.reactions[0].mine, true);
  });

test("Repeated sign-in events keep cache; account changes clear it; user updates invalidate only the profile", async () => {
  let listener;
  const invalidations = [],
    effects = [];
  let clears = 0;
  const queryClient = {
    clear() {
      clears++;
    },
    invalidateQueries(key) {
      invalidations.push(key);
      return Promise.resolve();
    },
  };
  const react = {
    createContext() {
      return { Provider: "provider" };
    },
    useEffect(fn) {
      effects.push(fn);
    },
    useState(initial) {
      return [initial, () => {}];
    },
    useMemo(fn) {
      return fn();
    },
  };
  const supabase = {
    auth: {
      onAuthStateChange(fn) {
        listener = fn;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      getSession() {
        return Promise.resolve({ data: { session: null } });
      },
    },
  };
  const { AuthProvider } = load("hooks/use-auth.tsx", {
    react: react,
    "react/jsx-runtime": {
      jsx() {
        return null;
      },
    },
    "@tanstack/react-query": {
      useQueryClient() {
        return queryClient;
      },
      useQuery() {
        return { refetch: async () => {} };
      },
    },
    "@/integrations/supabase/client": { supabase },
    "@/services/profiles": { profilesService: {} },
  });
  AuthProvider({ children: null });
  effects[0]();
  listener("SIGNED_IN", { user: { id: "a" } });
  listener("SIGNED_IN", { user: { id: "a" } });
  assert.equal(invalidations.length, 0);
  assert.equal(clears, 0);
  listener("USER_UPDATED", { user: { id: "a" } });
  assert.equal(invalidations.length, 1);
  assert.deepEqual(Array.from(invalidations[0].queryKey), ["profile", "a"]);
  listener("SIGNED_IN", { user: { id: "b" } });
  assert.equal(clears, 1);
  listener("SIGNED_OUT", null);
  assert.equal(clears, 2);
});
