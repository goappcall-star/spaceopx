import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import { useAuth } from "@/hooks/use-auth";
import { GlobalPresenceProvider } from "@/hooks/use-global-presence";
import { SessionCommunications } from "@/components/call/SessionCommunications";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const profile = await context.queryClient.fetchQuery({
      queryKey: ["profile", data.user.id],
      queryFn: () => profilesService.getById(data.user.id),
      staleTime: 30_000,
    });
    if (!profile) {
      throw redirect({ to: "/complete-registration", search: { redirect: location.href } });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, profile } = useAuth();
  return (
    <GlobalPresenceProvider userId={user?.id} profileStatus={profile?.status}>
      <SessionCommunications key={user?.id}>
        <Outlet />
      </SessionCommunications>
    </GlobalPresenceProvider>
  );
}
