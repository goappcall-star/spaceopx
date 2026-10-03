import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth";
import { teardownPresence } from "@/hooks/use-global-presence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export function AccountSettings() {
  const { profile, user } = useAuth();
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
  return (
    <div className="max-w-3xl space-y-7">
      <section className="border-border bg-surface overflow-hidden rounded-2xl border">
        <div className="bg-primary/10 h-20" />
        <div className="px-6 pb-6">
          <Avatar frame={profile?.avatar_frame} className="border-surface -mt-8 h-16 w-16 border-4">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{profile?.display_name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <h2 className="mt-3 text-lg font-bold">{profile?.display_name}</h2>
          <p className="text-muted-foreground text-sm">@{profile?.username}</p>
          <dl className="border-border mt-6 space-y-5 border-t pt-5">
            <div>
              <dt className="text-muted-foreground text-xs font-semibold uppercase">E-mail</dt>
              <dd className="mt-1 break-all text-sm">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-semibold uppercase">
                Nome de usuário
              </dt>
              <dd className="mt-1 text-sm">{profile?.username}</dd>
              <p className="text-muted-foreground mt-1 text-xs">
                Seu nome de usuário é único e permanente.
              </p>
            </div>
          </dl>
        </div>
      </section>
      <section className="border-border border-t pt-6">
        <h2 className="font-semibold">Sessão atual</h2>
        <p className="text-muted-foreground mt-1 mb-4 text-sm">
          Sair encerra sua sessão neste aplicativo.
        </p>
        <Button variant="destructive" disabled={busy} onClick={() => void leave()}>
          {busy ? "Saindo…" : "Sair da conta"}
        </Button>
      </section>
    </div>
  );
}
