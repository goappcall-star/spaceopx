/** Only same-origin relative paths are allowed as post-auth destinations. */
export function safeRedirect(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes(String.fromCharCode(92)) || [...value].some(char => char.charCodeAt(0) <= 32)) return fallback;
  const path = value.split(/[?#]/)[0];
  if (["/login", "/register", "/auth-callback", "/complete-registration"].includes(path ?? "")) return fallback;
  return value;
}
