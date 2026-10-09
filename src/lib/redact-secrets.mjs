export function redactSecrets(value) {
  return String(value)
    .replace(
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
      "[REDACTED]",
    )
    .replace(/\b(?:Bearer\s+)[^\s,"'<>]+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sb_secret_|sb_publishable_|ghp_|github_pat_)[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\b(postgres(?:ql)?:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(
      /([?&](?:access_token|refresh_token|token|password|secret|code|apikey|api_key)=)[^&#\s]+/gi,
      "$1[REDACTED]",
    );
}

export function redactedJson(value) {
  return redactSecrets(
    JSON.stringify(value, (key, item) =>
      /^(?:password|passwd|secret|client_secret|private_key|authorization|apikey|api_key|access_token|refresh_token|service_role_key)$/i.test(
        key,
      )
        ? "[REDACTED]"
        : item,
    ) ?? String(value),
  );
}
