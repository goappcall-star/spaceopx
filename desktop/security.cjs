const { createHash } = require("node:crypto");

function trusted(url) {
  try {
    const value = new URL(url);
    return (
      value.protocol === "lobbyx:" &&
      value.hostname === "app" &&
      !value.port &&
      !value.username &&
      !value.password
    );
  } catch {
    return false;
  }
}

function externalHttps(url) {
  try {
    const value = new URL(url);
    return url.length <= 8192 && value.protocol === "https:" && !value.username && !value.password;
  } catch {
    return false;
  }
}

function htmlSecurityHeaders(html) {
  const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter((match) => match[1].trim())
    .map((match) => `'sha256-${createHash("sha256").update(match[1]).digest("base64")}'`);
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'wasm-unsafe-eval' ${hashes.join(" ")}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' https: data: blob:",
      "media-src 'self' https: blob:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };
}

module.exports = { trusted, externalHttps, htmlSecurityHeaders };
