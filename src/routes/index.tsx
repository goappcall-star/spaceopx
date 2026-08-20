import { createFileRoute, Link } from "@tanstack/react-router";
import { Gamepad2, Trophy, Users, Video } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "LobbyX — a plataforma social gamer de comunidades" },
      {
        name: "description",
        content:
          "Comunidades, chat em tempo real, voz, vídeo, screen share e progressão gamer com XP, níveis e badges.",
      },
      { property: "og:title", content: "LobbyX" },
      {
        property: "og:description",
        content: "Comunidades gamer com chat, voz, vídeo, screen share e progressão.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: Users,
    title: "Comunidades reais",
    text: "Crie lobbies com canais, cargos e convites. Cada comunidade tem o seu próprio espaço.",
  },
  {
    icon: Video,
    title: "Voz, vídeo e tela",
    text: "Entre em canais de voz, ligue a câmera ou compartilhe a gameplay direto no navegador.",
  },
  {
    icon: Trophy,
    title: "Progressão gamer",
    text: "XP, níveis, badges, jogos favoritos e status de partida no seu único perfil.",
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
            <Gamepad2 className="text-primary h-3.5 w-3.5" />
            Plataforma social gamer
          </span>
          <h1 className="mt-6 text-5xl leading-[1.05] font-semibold">
            Seu lobby, sua galera,
            <br />
            <span className="text-brand-gradient">sua próxima partida</span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl text-lg">
            LobbyX reúne sua comunidade em lobbies com chat em tempo real, canais de voz, vídeo,
            compartilhamento de tela, amizades, mensagens privadas e um perfil gamer com XP,
            níveis e badges.
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
