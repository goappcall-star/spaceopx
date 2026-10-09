import { supabase } from "@/integrations/supabase/client";
import { boundedText, validEmail, validPassword, validUsername } from "@/lib/input-validation.mjs";

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export const authService = {
  async signInWithGoogle(destination: string) {
    // Require the onboarding migration before starting OAuth; never silently
    // accept an automatically generated Google username on an older backend.
    const readiness = await supabase.rpc("google_registration_ready");
    if (readiness.error || readiness.data !== true)
      throw new Error("google_registration_not_configured");
    localStorage.setItem("lobbyx:auth-destination", destination);
    const origin = window.location.protocol === "lobbyx:" ? "lobbyx://app" : window.location.origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: origin + "/auth-callback",
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
    if (!data.url) throw new Error("missing_oauth_url");
    // Electron intercepts this navigation and opens the system browser.
    window.location.assign(data.url);
  },

  async completeRegistration(username: string) {
    const { error } = await supabase.rpc("complete_registration", {
      chosen_username: validUsername(username),
    });
    if (error) throw error;
  },

  async signUp({ email, password, username, displayName }: SignUpInput) {
    const { data, error } = await supabase.auth.signUp({
      email: validEmail(email),
      password: validPassword(password),
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          username: validUsername(username),
          display_name: boundedText(displayName, "Nome de exibição", 60, 1),
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validEmail(email),
      password: validPassword(password, 1),
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(validEmail(email), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password: validPassword(password) });
    if (error) throw error;
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
};
