import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, AtSign, LockKeyhole, Mail, UserRound } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth";
import { safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/register")({
  validateSearch: z.object({ redirect: z.string().optional() }),
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
  const search = useSearch({ from: "/register" });
  const destination = safeRedirect(search.redirect, "/app");
  const { isAuthenticated, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", username: "", displayName: "" });
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!loading && isAuthenticated) void navigate({ href: destination, replace: true });
  }, [loading, isAuthenticated, destination, navigate]);

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
    if (form.password !== confirmPassword) {
      toast.error("As senhas precisam ser iguais.");
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
        await navigate({ href: destination, replace: true });
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
        layout="scenic"
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
      layout="scenic"
      title="Criar conta no LobbyX"
      subtitle="Junte-se à nossa comunidade e faça parte de algo maior."
      footer={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-scenic-form">
        <div className="auth-field-row">
          <AuthField
            label="Nome de exibição"
            icon={UserRound}
            id="displayName"
            autoComplete="nickname"
            maxLength={60}
            required
            value={form.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            placeholder="Nome de exibição"
          />
          <AuthField
            label="Nome de usuário"
            icon={AtSign}
            id="username"
            autoComplete="username"
            aria-describedby="username-help"
            maxLength={32}
            required
            value={form.username}
            onChange={(e) => update("username", e.target.value)}
            placeholder="Nome de usuário"
          />
        </div>
        <p id="username-help" className="auth-field-help">
          Usuário único, minúsculo e sem espaços.
        </p>
        <AuthField
          label="E-mail"
          icon={Mail}
          id="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          placeholder="E-mail"
        />
        <AuthField
          label="Senha"
          icon={LockKeyhole}
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          placeholder="Mínimo de 8 caracteres"
        />
        <AuthField
          label="Confirmar senha"
          icon={LockKeyhole}
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmar senha"
        />
        <Button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Criando..." : "Criar conta"}
          <ArrowRight size={19} aria-hidden="true" />
        </Button>
      </form>
      <GoogleSignInButton
        destination={destination}
        placement="after"
        label="Cadastrar com Google"
      />
    </AuthShell>
  );
}
