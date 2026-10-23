import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { assertPublicSupabaseKey, assertSupabaseUrl } from "@/lib/supabase-key-policy.mjs";
import { validatePasswordChange, type PasswordChange } from "@/lib/account-password";

/** Verify current credentials without replacing the signed-in application's session. */
export async function changeAccountPassword(value: PasswordChange) {
  validatePasswordChange(value);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.email) throw userError ?? new Error("Missing authenticated account");
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  assertSupabaseUrl(url);
  assertPublicSupabaseKey(key);
  const verifier = createClient(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        return fetch(input, { ...init, headers });
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "lobbyx-password-verification",
    },
  });
  let verified = false;
  try {
    const { data, error } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: value.current,
    });
    if (error) throw error;
    verified = !!data.session;
    if (!verified || data.user?.id !== user.id) throw new Error("Account verification mismatch");
    const current = await supabase.auth.getSession();
    if (current.error || current.data.session?.user.id !== user.id)
      throw new Error("Account changed during verification");
    const updated = await supabase.auth.updateUser({
      password: value.next,
      current_password: value.current,
    });
    if (updated.error) throw updated.error;
  } finally {
    // Revoke only the temporary verification session, never the user's main session.
    if (verified) await verifier.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}
