import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Recuperar senha — LobbyX" },
      { name: "description", content: "Receba um link para redefinir a senha da sua conta." },
      { property: "og:title", content: "Recuperar senha — LobbyX" },
      { property: "og:description", content: "Receba um link para redefinir sua senha." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      toast.error("Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para redefinir sua senha."
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <p className="text-muted-foreground text-sm">
          Se existir uma conta para{" "}
          <span className="text-foreground font-medium">{email}</span>, o link de redefinição já
          está a caminho.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
