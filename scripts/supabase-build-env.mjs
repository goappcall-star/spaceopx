export function supabaseBuildEnv(source) {
  const env = { ...source };
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']) {
    const value = (source[`VITE_${name}`] || source[name] || '').trim();
    if (!value) throw new Error(`Missing ${name}. Configure it in the Vercel deployment environment and rebuild.`);
    if (name === 'SUPABASE_PUBLISHABLE_KEY' && value.startsWith('sb_secret_')) {
      throw new Error('SUPABASE_PUBLISHABLE_KEY must be a public key, never a Supabase secret key.');
    }
    env[`VITE_${name}`] = value;
    env[name] = value;
  }
  return env;
}
