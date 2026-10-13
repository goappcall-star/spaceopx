import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { copyText } from "../src/lib/clipboard.ts";
import { inviteLink } from "../src/lib/invite-link.ts";
const { installClipboard } = createRequire(import.meta.url)("../desktop/clipboard.cjs");
test("Desktop invites always use the public HTTPS app, WEB keeps its origin", () => {
  for (const origin of ["null", "lobbyx://app", "file://", undefined]) assert.equal(inviteLink("technical-code", origin), "https://lobbyx-nine.vercel.app/invite/technical-code");
  assert.equal(inviteLink("abc", "https://lobbyx-nine.vercel.app"), "https://lobbyx-nine.vercel.app/invite/abc");
  assert.equal(inviteLink("abc", "http://127.0.0.1:5197"), "http://127.0.0.1:5197/invite/abc");
  assert.ok(inviteLink("a/b").endsWith("a%2Fb"));
});
test("Native copy takes precedence; browser copy still works and failures propagate", async () => {
  const writes = [];
  await copyText("invite", { desktop: { writeText: async t => writes.push("native:" + t) }, web: { writeText: async () => { throw Error("blocked"); } } });
  await copyText("web", { web: { writeText: async t => writes.push(t) } });
  assert.deepEqual(writes, ["native:invite", "web"]);
  await assert.rejects(copyText("invite", {}));
  await assert.rejects(copyText("invite", { desktop: { writeText: async () => { throw Error("failed"); } } }));
});
test("Native clipboard IPC rejects other pages, frames and invalid payloads", () => {
  let handler; const writes = []; let removed;
  const frame = { url: "lobbyx://app/app" }, contents = { mainFrame: frame };
  const stop = installClipboard({ window: { webContents: contents, isDestroyed: () => false },
    ipcMain: { handle: (_name, fn) => { handler = fn; }, removeHandler: name => { removed = name; } },
    clipboard: { writeText: t => writes.push(t) }, trusted: url => url === "lobbyx://app/app" });
  const event = { sender: contents, senderFrame: frame };
  assert.equal(handler(event, "https://lobbyx-nine.vercel.app/invite/test"), true);
  assert.throws(() => handler({ ...event, sender: {} }, "x"), /Forbidden/);
  assert.throws(() => handler({ ...event, senderFrame: { url: frame.url } }, "x"), /Forbidden/);
  frame.url = "https://external.example";
  assert.throws(() => handler(event, "x"), /Forbidden/); frame.url = "lobbyx://app/app";
  for (const payload of [null, {}, "x".repeat(65537)]) assert.throws(() => handler(event, payload), /Invalid/);
  assert.equal(writes.length, 1); stop(); assert.equal(removed, "desktop:clipboard-write");
});
