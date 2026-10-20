import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowRight, Mail, LockKeyhole } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth";
import { safeRedirect } from "@/lib/redirect";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — LobbyX" },
      { name: "description", content: "Acesse sua conta LobbyX e volte aos seus servidores." },
      { property: "og:title", content: "Entrar — LobbyX" },
      { property: "og:description", content: "Acesse sua conta LobbyX." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/login" });
  const { isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const destination = safeRedirect(search.redirect, "/app");

  useEffect(() => {
    if (!loading && isAuthenticated) void navigate({ href: destination, replace: true });
  }, [loading, isAuthenticated, destination, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await authService.signIn(email.trim(), password);
      toast.success("Bem-vindo de volta!");
      await navigate({ href: destination, replace: true });
    } catch (error) {
      toast.error(
        error instanceof Error && error.message.includes("Invalid login")
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      layout="scenic"
      title="Entrar no LobbyX"
      subtitle="Acesse sua conta e continue de onde parou."
      footer={
        <>
          Ainda não tem conta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-scenic-form">
        <AuthField
          label="E-mail"
          icon={Mail}
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
        />
        <AuthField
          label="Senha"
          icon={LockKeyhole}
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
        />
        <div className="auth-form-options">
          <Link to="/forgot-password">Esqueci minha senha</Link>
        </div>
        <Button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
          <ArrowRight size={19} aria-hidden="true" />
        </Button>
      </form>
      <GoogleSignInButton destination={destination} placement="after" label="Entrar com Google" />
    </AuthShell>
  );
}
