/** Compatible with Nitro Request proxies, including SPA prerendering. */
export function withSecurityNonce(request: Request, nonce: string): Request {
  const headers = new Headers(request.headers);
  headers.set("x-lobbyx-csp-nonce", nonce);
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    signal: request.signal,
  };
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    init.body = request.body;
    init.duplex = "half";
  }
  return new Request(request.url, init);
}

export function securityHeaders(nonce: string, development = false): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' ${development ? "'unsafe-inline'" : `'nonce-${nonce}'`} 'wasm-unsafe-eval'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' https: data: blob:",
      "media-src 'self' https: blob:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co${development ? " http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*" : ""}`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      ...(!development ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()",
    ...(!development ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

export function secureResponse(response: Response, nonce: string, development = false): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(nonce, development)))
    headers.set(name, value);
  // Per-request nonces and authentication redirects must not be shared by a CDN.
  if (headers.get("content-type")?.includes("text/html"))
    headers.set("Cache-Control", "private, no-store");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
