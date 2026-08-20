import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, Layers, Lock, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "LobbyX — servidores e canais com segurança em primeiro lugar" },
      {
        name: "description",
        content:
          "Crie servidores, canais e cargos com isolamento de dados garantido no banco. A base para uma plataforma de comunicação segura.",
      },
      { property: "og:title", content: "LobbyX" },
      {
        property: "og:description",
        content: "Servidores, canais e cargos com isolamento de dados garantido no banco.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: Lock,
    title: "Isolamento por servidor",
    text: "Cada servidor é um tenant. As regras de acesso vivem no banco de dados, não no navegador.",
  },
  {
    icon: Layers,
    title: "Cargos desde o início",
    text: "Proprietário, administrador e membro são criados junto com o servidor, de forma transacional.",
  },
  {
    icon: KeyRound,
    title: "Convites controlados",
    text: "Códigos únicos com validade e limite de usos, validados no servidor a cada entrada.",
  },
];

function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="bg-hero-glow min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button asChild>
              <Link to="/app">Abrir app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Criar conta</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-14 pb-24">
        <section className="max-w-2xl">
          <span className="border-border bg-surface text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <ShieldCheck className="text-primary h-3.5 w-3.5" />
            Fundação segura · etapa 1
          </span>
          <h1 className="mt-6 text-5xl leading-[1.05] font-semibold">
            Comunidades em canais,
            <br />
            <span className="text-brand-gradient">com segurança na base</span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-lg">
            LobbyX organiza pessoas em servidores, canais e cargos. O isolamento entre
            servidores é garantido pelo próprio banco de dados — pronto para receber monitoramento
            inteligente no futuro.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={isAuthenticated ? "/app" : "/register"}>
                {isAuthenticated ? "Abrir meus servidores" : "Começar agora"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="panel p-6">
              <span className="bg-secondary mb-4 flex h-10 w-10 items-center justify-center rounded-xl">
                <pillar.icon className="text-primary h-5 w-5" />
              </span>
              <h2 className="text-base font-semibold">{pillar.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm">{pillar.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
