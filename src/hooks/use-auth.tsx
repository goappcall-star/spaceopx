import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import type { Profile } from "@/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let disposed = false;
    let receivedEvent = false;
    let previousUser: string | null = null;
    // Listener first, then the initial read — avoids missing an early event.
    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (disposed) return;
      receivedEvent = true;
      setSession(nextSession);
      setLoading(false);
      const nextUser = nextSession?.user.id ?? null;
      if (event === "SIGNED_OUT" || (previousUser !== null && previousUser !== nextUser)) {
        queryClient.clear();
      } else if (event === "USER_UPDATED") {
        void queryClient.invalidateQueries({ queryKey: ["profile", nextUser] });
      }
      previousUser = nextUser;
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (disposed || receivedEvent) return;
        setSession(data.session);
        previousUser = data.session?.user.id ?? null;
        setLoading(false);
      })
      .catch(() => {
        if (!disposed && !receivedEvent) setLoading(false);
      });

    return () => {
      disposed = true;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => (userId ? profilesService.getById(userId) : Promise.resolve(null)),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile ?? null,
      loading,
      isAuthenticated: Boolean(session?.user),
      refreshProfile: async () => {
        await refetch();
      },
    }),
    [session, profile, loading, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
