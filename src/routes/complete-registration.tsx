import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { profilesService } from "@/services/profiles";
import { authService } from "@/services/auth";
import { useAuth } from "@/hooks/use-auth";
import { safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/complete-registration")({
  ssr: false,
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ search }) => {
    const { data, error } = await supabase.auth.getUser();
    if(error || !data.user) throw redirect({ to: "/login" });
    if(await profilesService.getById(data.user.id)) throw redirect({ href: safeRedirect(search.redirect, "/app") });
  },
  component: CompleteRegistration,
});
function CompleteRegistration() {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError("");
    const chosen = username.trim().toLowerCase();
    if(!/^[a-z0-9_.]{3,32}$/.test(chosen)) { setError("Use de 3 a 32 caracteres: letras, números, ponto ou sublinhado."); return; }
    setBusy(true);
    try {
      await authService.completeRegistration(chosen);
      await refreshProfile();
      await navigate({ href: safeRedirect(search.redirect, "/app"), replace: true });
    } catch (failure) {
      const code = (failure as { code?: string }).code;
      setError(code === "23505" ? "Esse usuário já está em uso. Escolha outro." : "Não foi possível concluir o cadastro. Tente novamente.");
    } finally { setBusy(false); }
  }
  async function cancel() {
    setBusy(true);
    try { await authService.signOut(); await navigate({ to: "/login", replace: true }); }
    catch { setError("Não foi possível sair. Tente novamente."); }
    finally { setBusy(false); }
  }
  return <AuthShell title="Escolha seu usuário" subtitle="Falta este passo para concluir sua conta no LobbyX.">
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="chosen-username">Seu usuário</Label>
        <Input id="chosen-username" value={username} onChange={event => setUsername(event.target.value)} placeholder="seu_usuario" autoComplete="off" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} disabled={busy} aria-describedby="username-help registration-error" />
        <p id="username-help" className="text-muted-foreground text-xs">Escolha um nome único. Ele será permanente e não é preenchido pelo Google.</p>
      </div>
      <p id="registration-error" role="alert" className="text-destructive text-sm">{error}</p>
      <Button className="w-full" disabled={busy || !username.trim()}>{busy ? "Aguarde…" : "Concluir cadastro"}</Button>
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={cancel}>Sair e continuar depois</Button>
    </form>
  </AuthShell>;
}
