import test from "node:test";
import assert from "node:assert/strict";
import { parseChatFormatting } from "../src/lib/chat-formatting.ts";

const text = value => ({ kind: "text", value });
const span = (kind, ...children) => ({ kind, children });
const plain = nodes => nodes.map(n => n.kind === "text" ? n.value : plain(n.children)).join("");

test("All requested chat styles and underline combinations", () => {
  for (const [source, expected] of [
    ["*itálico*", span("italic", text("itálico"))],
    ["_itálico_", span("italic", text("itálico"))],
    ["**negrito**", span("bold", text("negrito"))],
    ["***ambos***", span("boldItalic", text("ambos"))],
    ["__sublinhado__", span("underline", text("sublinhado"))],
    ["~~tachado~~", span("strike", text("tachado"))],
    ["__*texto*__", span("underline", span("italic", text("texto")))],
    ["__**texto**__", span("underline", span("bold", text("texto")))],
    ["__***texto***__", span("underline", span("boldItalic", text("texto")))],
    ["___texto___", span("underline", span("italic", text("texto")))],
  ]) assert.deepEqual(parseChatFormatting(source), [expected], source);
});

test("Nested endings, adjacent styles and multiline content", () => {
  assert.deepEqual(parseChatFormatting("**negrito *itálico***"), [span("bold", text("negrito "), span("italic", text("itálico")))]);
  assert.deepEqual(parseChatFormatting("*a* **b**"), [span("italic", text("a")), text(" "), span("bold", text("b"))]);
  assert.deepEqual(parseChatFormatting("**um\ndois**"), [span("bold", text("um\ndois"))]);
});

test("Escaped markers and incomplete syntax stay readable", () => {
  for (const [source, expected] of [["\\*literal\\*", "*literal*"], ["**sem final", "**sem final"], ["* espaços *", "* espaços *"], ["~~incompleto", "~~incompleto"], ["nome_do_usuario", "nome_do_usuario"], ["****texto****", "****texto****"]]) {
    assert.equal(plain(parseChatFormatting(source)), expected);
  }
});

test("Handles, HTML, unsafe URLs and notification text remain raw data", () => {
  assert.deepEqual(parseChatFormatting("**@nome_do_usuario**"), [span("bold", text("@nome_do_usuario"))]);
  for (const source of ['<img src=x onerror=alert(1)>', '<script>alert(1)</script>', '[abrir](javascript:alert(1))', 'https://exemplo.com/nome_do_usuario', 'conta_email@exemplo.com']) {
    assert.equal(plain(parseChatFormatting(source)), source);
    assert.ok(parseChatFormatting(source).every(node => node.kind === "text"));
  }
});

test("Long malformed input stays bounded without recursion through the source", () => {
  const source = "*__~~".repeat(2000) + "mensagem";
  const parsed = parseChatFormatting(source);
  const depth = nodes => Math.max(0, ...nodes.map(n => n.kind === "text" ? 0 : 1 + depth(n.children)));
  assert.ok(depth(parsed) <= 16);
  assert.ok(plain(parsed).includes("mensagem"));
});
