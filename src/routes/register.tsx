import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Criar conta — LobbyX" },
      {
        name: "description",
        content: "Crie sua conta LobbyX e monte seu primeiro servidor de comunicação.",
      },
      { property: "og:title", content: "Criar conta — LobbyX" },
      { property: "og:description", content: "Crie sua conta e monte seu primeiro servidor." },
    ],
  }),
  component: RegisterPage,
});

const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;

function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", username: "", displayName: "" });
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) void navigate({ to: "/app", replace: true });
  }, [loading, isAuthenticated, navigate]);

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!USERNAME_RE.test(username)) {
      toast.error("Username deve ter 3-32 caracteres: letras minúsculas, números, _ ou .");
      return;
    }
    if (form.password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authService.signUp({
        email: form.email.trim(),
        password: form.password,
        username,
        displayName: form.displayName.trim() || username,
      });

      if (result.session) {
        toast.success("Conta criada!");
        await navigate({ to: "/app", replace: true });
      } else {
        setEmailSent(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      toast.error(
        message.includes("already registered")
          ? "Este e-mail já está cadastrado."
          : "Não foi possível criar a conta.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (emailSent) {
    return (
      <AuthShell
        title="Confirme seu e-mail"
        subtitle="Enviamos um link de confirmação para você."
        footer={
          <Link to="/login" className="text-primary font-medium hover:underline">
            Voltar para o login
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">
          Abra o link enviado para <span className="text-foreground font-medium">{form.email}</span>{" "}
          para ativar sua conta. Depois disso é só entrar normalmente.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Criar conta"
      subtitle="Leva menos de um minuto."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Nome de exibição</Label>
          <Input
            id="displayName"
            required
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            placeholder="Ana Souza"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            required
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            placeholder="ana.souza"
            className="font-mono"
          />
          <p className="text-muted-foreground text-xs">Único, minúsculo, sem espaços.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="voce@exemplo.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Mínimo de 8 caracteres"
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Criando..." : "Criar conta"}
        </Button>
      </form>
    </AuthShell>
  );
}
