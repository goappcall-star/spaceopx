/** Only same-origin relative paths are allowed as post-auth destinations. */
export function safeRedirect(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
