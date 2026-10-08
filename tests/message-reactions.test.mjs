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
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
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
  const options = {
    channelId: "room",
    conversationId: "conversation",
    userId: "me",
    profiles,
    enabled: true,
  };
  function render(next) {
    Object.assign(options, next);
    let count = 0;
    do {
      dirty = false;
      cursor = 0;
      pending = [];
      value = hook(options);
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
    service,
    setRows: (r) => {
      rows = r;
    },
  };
}
for (const kind of ["server", "dm"]) {
  const moveTo = (id) => ({ channelId: id, conversationId: id });
  const message = (id) => ({ id, content: id, created_at: "2026-10-07T00:00:00Z", reactions: [] });
  test(kind + ": a message received while history loads remains visible", async () => {
    const f = fixture(kind);
    await f.flush();
    const pending = deferred();
    f.service.list = () => pending.promise;
    f.render(moveTo("pending-room"));
    await f.events[(kind === "server" ? "messages" : "direct_messages") + ":INSERT"]({
      new: message("new-realtime"),
    });
    await f.flush();
    pending.resolve([message("older-history")]);
    await f.flush();
    assert.deepEqual(
      Array.from(f.render().messages, (m) => m.id),
      ["older-history", "new-realtime"],
    );
  });
  test(kind + ": replies hydrate authors outside the current message page", async () => {
    const profilesService = {
      listByIds: async (ids) => ids.map((id) => ({ id, display_name: id })),
    };
    const supabase = {
      from(table) {
        return {
          select() {
            return this;
          },
          async in() {
            return {
              data: table.endsWith("reactions")
                ? []
                : [
                    {
                      id: "reply",
                      author_id: "reply-author",
                      sender_id: "reply-author",
                      content: "Old message",
                    },
                  ],
            };
          },
        };
      },
    };
    const imports = {
      "@/integrations/supabase/client": { supabase },
      "@/services/profiles": { profilesService },
      "@/services/messages": { groupReactions },
      "@/services/uploads": {},
    };
    const module = load(kind === "server" ? "services/messages.ts" : "services/social.ts", imports);
    const service = module.messagesService ?? module.directMessagesService;
    const [hydrated] = await service.hydrate(
      [
        {
          ...message("message"),
          author_id: "current-author",
          sender_id: "current-author",
          reply_to_id: "reply",
        },
      ],
      "me",
    );
    assert.equal(hydrated.replyTo.author.id, "reply-author");
  });
  test(kind + ": an old realtime hydration cannot enter the newly opened chat", async () => {
    const f = fixture(kind);
    await f.flush();
    const pending = deferred();
    f.service.hydrate = (rows) =>
      rows[0]?.id === "old-realtime" ? pending.promise : Promise.resolve(rows);
    const handler = f.events[(kind === "server" ? "messages" : "direct_messages") + ":INSERT"];
    const event = handler({ new: message("old-realtime") });
    f.render(moveTo("next"));
    assert.equal(f.render().messages.length, 0);
    pending.resolve([message("old-realtime")]);
    await event;
    await f.flush();
    assert.equal(
      f.render().messages.some((m) => m.id === "old-realtime"),
      false,
    );
  });
  test(kind + ": sending in one chat cannot append its reply after navigating away", async () => {
    const f = fixture(kind);
    await f.flush();
    const pending = deferred();
    f.service.send = () => pending.promise;
    const sending = f.render().send({ content: "old" });
    f.render(moveTo("next"));
    await f.flush();
    pending.resolve(message("old-send"));
    await sending;
    await f.flush();
    assert.equal(
      f.render().messages.some((m) => m.id === "old-send"),
      false,
    );
  });
  test(kind + ": older history cannot leak across chat changes", async () => {
    const f = fixture(kind);
    await f.flush();
    const pending = deferred();
    f.service.list = (_id, before) =>
      before ? pending.promise : Promise.resolve([message("new-history")]);
    const loading = f.render().loadOlder();
    f.render(moveTo("next"));
    await f.flush();
    pending.resolve([message("old-page")]);
    await loading;
    await f.flush();
    assert.deepEqual(
      Array.from(f.render().messages, (m) => m.id),
      ["new-history"],
    );
    assert.equal(f.render().loadingMore, false);
  });
  test(kind + ": history failure is handled and clears loading", async () => {
    const f = fixture(kind);
    await f.flush();
    f.service.list = async () => {
      throw Error("offline");
    };
    f.render(moveTo("offline"));
    await f.flush();
    assert.ok(f.render().error);
    assert.equal(f.render().loading, false);
    assert.equal(f.render().messages.length, 0);
  });
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
