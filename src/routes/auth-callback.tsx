import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/auth-callback")({ ssr: false, component: AuthCallback });
function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function finish() {
      const params = new URLSearchParams(window.location.search);
      // The Supabase client's initialization exchanges the PKCE code once.
      const initialization = await supabase.auth.initialize();
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (params.has("error") || initialization.error || error || !data.session) {
        setFailed(true);
        return;
      }
      const destination = safeRedirect(
        localStorage.getItem("lobbyx:auth-destination") ?? undefined,
        "/app",
      );
      localStorage.removeItem("lobbyx:auth-destination");
      await navigate({ href: destination, replace: true });
    }
    void finish().catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [navigate]);
  return (
    <AuthShell
      title={failed ? "Não foi possível entrar" : "Conectando sua conta"}
      subtitle={
        failed
          ? "A autorização foi cancelada ou expirou. Tente conectar ao Google novamente."
          : "Só mais um momento…"
      }
    >
      {failed && (
        <Link to="/login" className="text-primary hover:underline">
          Voltar para entrar
        </Link>
      )}
    </AuthShell>
  );
}
