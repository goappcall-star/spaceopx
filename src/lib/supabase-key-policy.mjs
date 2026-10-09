/** Prevent accidental distribution of privileged credentials; never include values in errors. */
export function assertPublicSupabaseKey(key) {
  if (typeof key === "string" && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  try {
    const parts = key.split(".");
    if (parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) {
      const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
      if (JSON.parse(atob(payload)).role === "anon") return;
    }
  } catch {
    /* Fail closed for malformed or privileged credentials. */
  }
  throw new Error(
    "Supabase browser configuration requires a publishable key or legacy anon key. Privileged keys are forbidden.",
  );
}

export function assertSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid Supabase URL configuration.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Supabase must use HTTPS; HTTP is allowed only for a local development backend.",
    );
}
