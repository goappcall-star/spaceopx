export type ChatFormatNode =
  | { kind: "text"; value: string }
  | { kind: "italic" | "bold" | "boldItalic" | "underline" | "strike"; children: ChatFormatNode[] };

interface Frame {
  marker: string;
  kind: Exclude<ChatFormatNode["kind"], "text">;
  children: ChatFormatNode[];
}

/** Inline chat syntax only. No HTML, links, embeds, or network access. */
export function parseChatFormatting(content: string): ChatFormatNode[] {
  const root: ChatFormatNode[] = [];
  const stack: Frame[] = [];
  let pending: string[] = [];
  const target = () => stack.at(-1)?.children ?? root;
  const flush = () => {
    if (pending.length) target().push({ kind: "text", value: pending.join("") });
    pending = [];
  };
  const word = (char: string) => /[\p{L}\p{N}_]/u.test(char);

  for (let i = 0; i < content.length;) {
    const char = content[i]!;
    if (char === "@") {
      let end = i + 1;
      while (end < content.length && /[a-z0-9_.-]/i.test(content[end]!)) end++;
      pending.push(content.slice(i, end));
      i = end;
      continue;
    }
    if (char === "\\" && i + 1 < content.length && /[*_~\\]/.test(content[i + 1]!)) {
      pending.push(content[i + 1]!);
      i += 2;
      continue;
    }
    if (char !== "*" && char !== "_" && char !== "~") {
      pending.push(char);
      i++;
      continue;
    }
    let end = i + 1;
    while (content[end] === char) end++;
    let count = end - i;
    const before = content[i - 1] ?? "";
    const after = content[end] ?? "";
    // Preserve handles, URLs and words such as nome_do_usuario.
    if (
      (char === "_" && word(before) && word(after)) ||
      count > 3 ||
      (char === "~" && count !== 2)
    ) {
      pending.push(content.slice(i, end));
      i = end;
      continue;
    }
    flush();
    const canClose = !!before && !/\s/.test(before);
    const canOpen = !!after && !/\s/.test(after);
    while (
      canClose &&
      stack.length &&
      stack.at(-1)!.marker[0] === char &&
      stack.at(-1)!.marker.length <= count
    ) {
      const frame = stack.pop()!;
      count -= frame.marker.length;
      target().push({ kind: frame.kind, children: frame.children });
    }
    if (count) {
      if (canOpen && stack.length + (char === "_" && count === 3 ? 2 : 1) <= 16) {
        const marker = char.repeat(count);
        // ___text___ combines underline with italic, like __*text*__.
        const kind =
          char === "~"
            ? "strike"
            : char === "_" && count >= 2
              ? "underline"
              : count === 3
                ? "boldItalic"
                : count === 2
                  ? "bold"
                  : "italic";
        stack.push({ marker, kind, children: [] });
        if (char === "_" && count === 3) {
          stack.at(-1)!.marker = "__";
          stack.push({ marker: "_", kind: "italic", children: [] });
        }
      } else pending.push(char.repeat(count));
    }
    i = end;
  }
  flush();
  // Incomplete formatting stays visible while preserving completed inner spans.
  while (stack.length) {
    const frame = stack.pop()!;
    target().push({ kind: "text", value: frame.marker }, ...frame.children);
  }
  return root;
}
