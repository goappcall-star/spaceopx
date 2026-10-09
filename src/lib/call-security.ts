/** Reject malformed rings and attempts to open a control room for another pair. */
export function validIncomingRing(value: unknown, recipientId: string): boolean {
  if (!value || typeof value !== "object") return false;
  const ring = value as Record<string, unknown>;
  if (
    typeof ring["callId"] !== "string" ||
    typeof ring["video"] !== "boolean" ||
    !ring["from"] ||
    typeof ring["from"] !== "object"
  )
    return false;
  const sender = ring["from"] as Record<string, unknown>;
  const pair = /^([a-f0-9-]{36})-([a-f0-9-]{36})-[a-z0-9]{1,20}$/i.exec(ring["callId"]);
  if (!pair || pair[1] !== sender["id"] || pair[2] !== recipientId || sender["id"] === recipientId)
    return false;
  if (
    typeof sender["display_name"] !== "string" ||
    sender["display_name"].length > 128 ||
    typeof sender["username"] !== "string" ||
    sender["username"].length > 32
  )
    return false;
  if (sender["avatar_url"] != null) {
    if (typeof sender["avatar_url"] !== "string" || sender["avatar_url"].length > 8192)
      return false;
    try {
      const url = new URL(sender["avatar_url"]);
      if (url.protocol !== "https:" || url.username || url.password) return false;
    } catch {
      return false;
    }
  }
  return true;
}
