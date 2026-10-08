import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  UserRound,
  Paintbrush,
  Shield,
  Mic,
  Gamepad2,
  Heart,
  Monitor,
  Accessibility,
  Search,
  X,
  ChevronRight,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  {
    id: "account",
    label: "Minha conta",
    group: "Conta",
    icon: UserRound,
    description: "Informações de acesso e identificação da sua conta.",
  },
  {
    id: "profile",
    label: "Perfil",
    group: "Conta",
    icon: UserRound,
    description: "Personalize como você aparece para seus amigos.",
  },
  {
    id: "privacy",
    label: "Privacidade nas atividades",
    group: "Conta",
    icon: Shield,
    description: "Escolha o que compartilhar sobre seus jogos.",
  },
  {
    id: "voice",
    label: "Voz e áudio",
    group: "Experiência",
    icon: Mic,
    description: "Microfone, saída de som e controles de chamada.",
  },
  {
    id: "appearance",
    label: "Aparência",
    group: "Experiência",
    icon: Paintbrush,
    description: "Deixe o LobbyX com a sua cara.",
  },
  {
    id: "accessibility",
    label: "Acessibilidade",
    group: "Experiência",
    icon: Accessibility,
    description: "Ajuste movimento e efeitos para seu conforto.",
  },
  {
    id: "system",
    label: "Sistema e permissões",
    group: "Experiência",
    icon: Monitor,
    description: "Gerencie as autorizações deste computador.",
  },
  {
    id: "games",
    label: "Jogos registrados",
    group: "Jogos e apps",
    icon: Gamepad2,
    description: "Gerencie os jogos detectados e a visibilidade de cada um.",
  },
  {
    id: "favorites",
    label: "Jogos favoritos",
    group: "Jogos e apps",
    icon: Heart,
    description: "Escolha os jogos que fazem parte do seu perfil.",
  },
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];
export function SettingsShell({
  active,
  children,
}: {
  active: SettingsSection;
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const selected = SETTINGS_SECTIONS.find((item) => item.id === active)!;
  const normalized = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const items = SETTINGS_SECTIONS.filter((item) =>
    normalized(item.label + " " + item.description).includes(normalized(query)),
  );
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector('[role="dialog"], [data-state="open"][role="listbox"]')
      )
        return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((event.target as HTMLElement)?.tagName)) return;
      void navigate({ to: "/app" });
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [navigate]);
  return (
    <div className="settings-layout bg-background text-foreground min-h-dvh md:h-dvh md:overflow-hidden">
      <aside className="settings-sidebar bg-surface border-border border-b md:overflow-y-auto md:border-r md:border-b-0">
        <Link
          to="/settings/profile"
          search={{ section: "profile" }}
          className="mb-6 flex items-center gap-3 rounded-xl p-2 hover:bg-surface-hover"
        >
          <Avatar frame={profile?.avatar_frame} className="h-11 w-11">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{profile?.display_name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{profile?.display_name}</p>
            <span className="text-muted-foreground text-xs">Editar perfil</span>
          </div>
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        </Link>
        <div className="border-border bg-background mb-5 flex items-center gap-2 rounded-lg border px-3">
          <Search className="text-muted-foreground h-4 w-4" />
          <input
            aria-label="Buscar configurações"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar configurações"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {query && (
            <button aria-label="Limpar busca" onClick={() => setQuery("")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <label className="block md:hidden">
          <span className="sr-only">Seção das configurações</span>
          <select
            value={active}
            className="bg-surface border-border h-11 w-full rounded-lg border px-3 text-sm"
            onChange={(event) => {
              const id = event.target.value;
              void navigate({
                to: id === "voice" ? "/settings/voice" : "/settings/profile",
                search: id === "voice" ? {} : { section: id },
              });
            }}
          >
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label="Configurações" className="hidden space-y-5 md:block">
          {["Conta", "Experiência", "Jogos e apps"].map((group) => {
            const filtered = items.filter((item) => item.group === group);
            return (
              filtered.length > 0 && (
                <div key={group}>
                  <p className="text-muted-foreground mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider">
                    {group}
                  </p>
                  <div className="space-y-1">
                    {filtered.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          to={item.id === "voice" ? "/settings/voice" : "/settings/profile"}
                          search={item.id === "voice" ? {} : { section: item.id }}
                          aria-current={active === item.id ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                            active === item.id
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )
            );
          })}
          {items.length === 0 && (
            <p className="text-muted-foreground px-3 text-sm">Nenhuma configuração encontrada.</p>
          )}
        </nav>
        <div className="border-border text-muted-foreground mt-7 hidden border-t px-3 pt-4 text-xs md:block">
          LobbyX · Configurações
        </div>
      </aside>
      <main className="min-w-0 md:overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-10 lg:px-14 lg:py-12">
          <header className="mb-9 flex items-start justify-between gap-5">
            <div>
              <p className="text-muted-foreground mb-2 text-xs">Configurações / {selected.group}</p>
              <h1 className="text-2xl font-semibold tracking-tight">{selected.label}</h1>
              <p className="text-muted-foreground mt-2 max-w-xl text-sm">{selected.description}</p>
            </div>
            <Link
              to="/app"
              className="text-muted-foreground hover:text-foreground flex shrink-0 flex-col items-center gap-1"
              aria-label="Fechar configurações"
            >
              <span className="border-border hover:bg-surface-hover rounded-full border p-2">
                <X className="h-5 w-5" />
              </span>
              <span className="text-[10px]">ESC</span>
            </Link>
          </header>
          <div className="settings-content">{children}</div>
        </div>
      </main>
    </div>
  );
}
