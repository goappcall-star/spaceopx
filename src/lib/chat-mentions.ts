export function mentionedUsernames(content: string): Set<string> {
  return new Set(
    Array.from(content.matchAll(/(?:^|[^a-z0-9_.@-])@([a-z0-9_.-]+)/gi), (match) =>
      match[1]!.toLowerCase(),
    ),
  );
}

export function canNotifyMention(status: string): boolean {
  return status === "online" || status === "idle";
}
