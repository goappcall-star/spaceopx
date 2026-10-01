// Only accept an authorization code, never arbitrary deep-link navigation or tokens.
exports.authCallback = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'lobbyx:' || url.hostname !== 'app' || url.pathname !== '/auth-callback' || url.port || url.username || url.password || url.hash) return null;
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if (code && /^[a-zA-Z0-9_-]{8,2048}$/.test(code)) return 'lobbyx://app/auth-callback?code=' + encodeURIComponent(code);
    if (error) return 'lobbyx://app/auth-callback?error=access_denied';
    return null;
  } catch { return null; }
};
