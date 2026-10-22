import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth";
import { teardownPresence } from "@/hooks/use-global-presence";
import { AccountSettingsView } from "./AccountSettingsView";
import { accountDate, accountLoginMethods } from "@/lib/account-settings";
import { toast } from "sonner";
export function AccountSettings() {
  const { profile, user, session } = useAuth();
  const navigate = useNavigate();
  const query = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function leave() {
    setBusy(true);
    try {
      await authService.signOut();
      teardownPresence();
      query.clear();
      await navigate({ to: "/login", replace: true });
    } catch {
      toast.error("Não foi possível sair.");
    } finally {
      setBusy(false);
    }
  }
  const [online, setOnline] = useState(() => typeof navigator !== "undefined" && navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return (
    <AccountSettingsView
      name={profile?.display_name ?? ""}
      username={profile?.username ?? ""}
      avatar={profile?.avatar_url ?? undefined}
      frame={profile?.avatar_frame}
      email={user?.email}
      verified={user?.email ? !!user.email_confirmed_at : null}
      created={accountDate(user?.created_at)}
      methods={accountLoginMethods(user)}
      platform={
        typeof window !== "undefined" && window.lobbyxDesktop ? "LobbyX Desktop" : "LobbyX WEB"
      }
      online={online}
      expires={
        session?.expires_at
          ? new Date(session.expires_at * 1000).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null
      }
      busy={busy}
      onProfile={() => void navigate({ to: "/settings/profile", search: { section: "profile" } })}
      onPrivacy={() => void navigate({ to: "/settings/profile", search: { section: "privacy" } })}
      onSignOut={() => void leave()}
    />
  );
}
