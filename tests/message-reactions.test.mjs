import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
function load(file, imports) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(new URL("../src/" + file, import.meta.url), "utf8"), {
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
  return exports;
}
const { groupReactions } = load("services/messages.ts", {
  "@/integrations/supabase/client": {},
  "@/services/profiles": {},
});
function fixture(kind) {
  let cursor = 0,
    dirty = false,
    pending = [],
    value,
    rows = [];
  const slots = [],
    events = {},
    profiles = new Map();
  const memo = (fn, deps) => {
    const i = cursor++,
      old = slots[i];
    if (!old || deps.some((d, n) => !Object.is(d, old.deps[n]))) slots[i] = { value: fn(), deps };
    return slots[i].value;
  };
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (next) => {
          const v = typeof next === "function" ? next(slots[i]) : next;
          if (!Object.is(v, slots[i])) {
            slots[i] = v;
            dirty = true;
          }
        },
      ];
    },
    useRef: (initial) => memo(() => ({ current: initial }), []),
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const i = cursor++,
        old = slots[i];
      if (!old || deps.some((d, n) => !Object.is(d, old.deps[n])))
        pending.push(() => {
          old?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
    },
  };
  const service = {
    list: async () => [{ id: "message", content: "Test", reactions: [] }],
    hydrate: async (ms) => ms.map((m) => ({ ...m, reactions: groupReactions(rows, "me") })),
    listReactions: async () => rows,
    async addReaction(message_id, user_id, emoji) {
      rows = [...rows, { id: "reaction", message_id, user_id, emoji }];
    },
    async removeReaction(id, user, emoji) {
      rows = rows.filter((r) => r.message_id !== id || r.user_id !== user || r.emoji !== emoji);
    },
  };
  const channel = {
    on(_type, filter, fn) {
      events[filter.table + ":" + filter.event] = fn;
      return this;
    },
    subscribe() {
      return this;
    },
  };
  const imports = {
    react,
    sonner: { toast: { error() {} } },
    "@/integrations/supabase/client": {
      supabase: { channel: () => channel, removeChannel: async () => {} },
    },
    "@/services/messages": { groupReactions, messagesService: service, MESSAGE_PAGE_SIZE: 30 },
    "@/services/social": { directMessagesService: service, DM_PAGE_SIZE: 30 },
  };
  const module = load(
    kind === "server" ? "hooks/use-messages.ts" : "hooks/use-dm-messages.ts",
    imports,
  );
  const hook = module.useChannelMessages ?? module.useDirectMessages;
  function render() {
    let count = 0;
    do {
      dirty = false;
      cursor = 0;
      pending = [];
      value = hook({
        channelId: "room",
        conversationId: "conversation",
        userId: "me",
        profiles,
        enabled: true,
      });
      pending.forEach((fn) => fn());
      assert.ok(++count < 20);
    } while (dirty);
    return value;
  }
  async function flush() {
    for (let i = 0; i < 15; i++) await Promise.resolve();
    return render();
  }
  render();
  return {
    render,
    flush,
    events,
    setRows: (r) => {
      rows = r;
    },
  };
}
for (const kind of ["server", "dm"]) {
  test(
    kind + ": reacting updates and removes the visible reaction without a realtime echo",
    async () => {
      const f = fixture(kind);
      await f.flush();
      await f.render().toggleReaction("message", "fire");
      await f.flush();
      assert.equal(f.render().messages[0].reactions[0].mine, true);
      assert.equal(f.render().messages[0].reactions[0].count, 1);
      await f.render().toggleReaction("message", "fire");
      await f.flush();
      assert.equal(f.render().messages[0].reactions.length, 0);
    },
  );
  test(kind + ": DELETE containing only a primary key clears remote reactions", async () => {
    const f = fixture(kind);
    f.setRows([{ id: "r", message_id: "message", user_id: "peer", emoji: "fire" }]);
    await f.flush();
    assert.equal(f.render().messages[0].reactions.length, 1);
    f.setRows([]);
    f.events[(kind === "server" ? "message_reactions" : "direct_message_reactions") + ":*"]({
      eventType: "DELETE",
      new: {},
      old: { id: "r" },
    });
    await f.flush();
    assert.equal(f.render().messages[0].reactions.length, 0);
  });
}
