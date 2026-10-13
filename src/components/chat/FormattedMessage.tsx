import { memo, useMemo, type ReactNode } from "react";
import { parseChatFormatting, type ChatFormatNode } from "@/lib/chat-formatting";

function renderNodes(nodes: ChatFormatNode[], highlightMentions: boolean): ReactNode {
  return nodes.map((node, index) => {
    if (node.kind === "text") {
      if (!highlightMentions) return node.value;
      return node.value.split(/(@[a-z0-9_.-]+)/gi).map((part, partIndex) =>
        part.startsWith("@") ? (
          <span
            key={`${index}-${partIndex}`}
            className="bg-primary/15 text-primary rounded px-1 font-medium"
          >
            {part}
          </span>
        ) : (
          part
        ),
      );
    }
    const children = renderNodes(node.children, highlightMentions);
    switch (node.kind) {
      case "bold":
        return (
          <strong key={index} className="font-bold">
            {children}
          </strong>
        );
      case "italic":
        return (
          <em key={index} className="italic">
            {children}
          </em>
        );
      case "boldItalic":
        return (
          <strong key={index} className="font-bold">
            <em className="italic">{children}</em>
          </strong>
        );
      case "underline":
        return <u key={index}>{children}</u>;
      case "strike":
        return <s key={index}>{children}</s>;
    }
  });
}

/** Memoized by content: reactions and presence do not reparse unchanged messages. */
export const FormattedMessage = memo(function FormattedMessage({
  content,
  highlightMentions = false,
}: {
  content: string;
  highlightMentions?: boolean;
}) {
  const formatted = useMemo(
    () => renderNodes(parseChatFormatting(content), highlightMentions),
    [content, highlightMentions],
  );
  return <>{formatted}</>;
});
