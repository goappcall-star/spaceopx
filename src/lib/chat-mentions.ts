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

export interface MentionQuery {
  start: number;
  end: number;
  query: string;
}

export function mentionQueryAt(content: string, caret: number): MentionQuery | null {
  const prefix = content.slice(0, caret);
  const match = /(?:^|[^a-z0-9_.@-])@([a-z0-9_.-]*)$/i.exec(prefix);
  if (!match) return null;
  const query = match[1] ?? "";
  return { start: caret - query.length - 1, end: caret, query };
}

export function completeMention(content: string, query: MentionQuery, username: string) {
  const tail = content.slice(query.end);
  const suffix = tail.startsWith(" ") ? "" : " ";
  const inserted = `@${username}${suffix}`;
  return {
    content: content.slice(0, query.start) + inserted + tail,
    caret: query.start + inserted.length,
  };
}

export interface MentionOption {
  id: string;
  username: string;
  label: string;
  everyone: boolean;
}
export function mentionOptions(
  members: { user_id: string; profile?: { username: string; display_name: string } | null }[],
  query: string,
): MentionOption[] {
  const search = query.toLowerCase();
  const users = members
    .filter(
      (m) =>
        m.profile &&
        (m.profile.username.toLowerCase().includes(search) ||
          m.profile.display_name.toLowerCase().includes(search)),
    )
    .sort(
      (a, b) =>
        Number(!a.profile!.username.toLowerCase().startsWith(search)) -
        Number(!b.profile!.username.toLowerCase().startsWith(search)),
    )
    .map((m) => ({
      id: m.user_id,
      username: m.profile!.username,
      label: m.profile!.display_name,
      everyone: false,
    }));
  return [
    ...("todos".startsWith(search)
      ? [{ id: "everyone", username: "todos", label: "Todos do servidor", everyone: true }]
      : []),
    ...users,
  ].slice(0, 6);
}
