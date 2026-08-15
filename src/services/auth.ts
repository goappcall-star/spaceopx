import { supabase } from "@/integrations/supabase/client";

export interface SignUpInput {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export const authService = {
  async signUp({ email, password, username, displayName }: SignUpInput) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          username: username.trim().toLowerCase(),
          display_name: displayName.trim(),
        },
      },
    });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async requestPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
};
