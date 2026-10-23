import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("The real friendship loader can resolve requests without waiting for game presence", async () => {
  const exports = {};
  const imports = {
    "@/integrations/supabase/client": { supabase: {} },
    "@/services/profiles": {
      profilesService: { listByIds: async (ids) => ids.map((id) => ({ id, display_name: id })) },
    },
    "@/services/messages": {},
    "@/services/uploads": {},
    "@/lib/input-validation.mjs": {},
  };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/services/social.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  exports.friendsService.listRaw = async () => [
    { id: "pending", requester_id: "other", addressee_id: "me", status: "pending" },
  ];
  let presenceCalls = 0;
  exports.socialPresenceService.listByUsers = async () => {
    presenceCalls++;
    return new Promise(() => {});
  };
  const result = await exports.friendsService.load("me", false);
  assert.equal(result.requests[0].friendshipId, "pending");
  assert.equal(result.requests[0].direction, "incoming");
  assert.equal(presenceCalls, 0);
});

function fixture() {
  let cursor = 0,
    effects = [],
    status,
    removed = false;
  const state = [],
    handlers = [],
    invalidations = [],
    queries = [];
  const data = {
    friends: [{ profile: { id: "friend" }, friendshipId: "f" }],
    requests: [{ friendshipId: "pending" }],
  };
  const channel = {
    on(kind, filter, fn) {
      handlers.push({ filter, fn });
      return this;
    },
    subscribe(fn) {
      status = fn;
      return this;
    },
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = initial;
      return [state[i], (next) => (state[i] = next)];
    },
    useRef: (value) => ({ current: value }),
    useMemo: (fn) => fn(),
    useEffect: (fn) => effects.push(fn),
  };
  const imports = {
    react,
    "@tanstack/react-query": {
      useQueryClient: () => ({
        invalidateQueries: (options) => invalidations.push(options.queryKey),
      }),
      useQuery: (options) => {
        queries.push(options);
        return { data: options.queryKey[0] === "friends" ? data : undefined, isLoading: false };
      },
    },
    "@/integrations/supabase/client": {
      supabase: {
        channel: () => channel,
        removeChannel: () => {
          removed = true;
        },
      },
    },
    "@/services/social": {
      friendsService: { load: async () => data },
      socialPresenceService: {
        listByUsers: async () => {
          throw Error("Presence unavailable");
        },
      },
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync("src/hooks/use-social.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
    },
  );
  const render = () => {
    cursor = 0;
    effects = [];
    queries.length = 0;
    return exports.useFriends("me");
  };
  return {
    render,
    handlers,
    invalidations,
    queries,
    start: () => effects.map((fn) => fn()),
    status: (value) => status(value),
    removed: () => removed,
  };
}

test("Friend delivery closes the HTTP/subscription gap and recovers after reconnect", () => {
  const f = fixture();
  f.render();
  const cleanup = f.start()[0];
  const filters = f.handlers
    .filter((h) => h.filter.table === "friendships")
    .map((h) => h.filter.filter);
  assert.deepEqual(filters, ["requester_id=eq.me", "addressee_id=eq.me"]);
  assert.equal(f.queries[0].refetchInterval, 5000);
  f.status("SUBSCRIBED");
  assert.equal(f.invalidations.length, 2);
  f.render();
  assert.equal(f.queries[0].refetchInterval, 15000);
  f.status("CHANNEL_ERROR");
  f.render();
  assert.equal(f.queries[0].refetchInterval, 5000);
  f.status("SUBSCRIBED");
  assert.equal(f.invalidations.length, 4);
  cleanup();
  const count = f.invalidations.length;
  f.status("SUBSCRIBED");
  f.handlers[0].fn();
  assert.equal(f.invalidations.length, count);
  assert.equal(f.removed(), true);
});
test("Presence cannot block incoming requests; unrelated game changes do not reload friendships", async () => {
  const f = fixture(),
    result = f.render();
  f.start();
  assert.equal(result.requests[0].friendshipId, "pending");
  assert.equal(result.friends[0].presence, null);
  const presence = f.queries[1];
  await assert.rejects(presence.queryFn(), /Presence unavailable/);
  const game = f.handlers.find((h) => h.filter.table === "user_game_presence");
  game.fn({ new: { user_id: "unrelated" }, old: {} });
  assert.equal(f.invalidations.length, 0);
  game.fn({ new: { user_id: "friend" }, old: {} });
  assert.deepEqual(Array.from(f.invalidations[0]), ["friend-game-presence", "me"]);
});
