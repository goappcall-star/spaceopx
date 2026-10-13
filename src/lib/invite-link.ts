const PUBLIC_APP = "https://lobbyx-nine.vercel.app";
export function inviteLink(code: string, origin?: string): string {
  let base = PUBLIC_APP;
  try {
    const url = new URL(origin ?? PUBLIC_APP);
    if (url.protocol === "https:" || url.protocol === "http:") base = url.origin;
  } catch {
    /* Custom desktop origins can be opaque. Use the public WEB origin. */
  }
  return `${base}/invite/${encodeURIComponent(code)}`;
}
