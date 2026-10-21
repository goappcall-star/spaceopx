import { useState, type ReactNode } from "react";
import { CommunityBanner, CommunitySeal } from "./CommunityAppearance";
import { appearanceStyle } from "@/lib/community-appearance";
import type { Appearance } from "@/types/community-evolution";
import {
  ArrowRight,
  CalendarDays,
  Hash,
  Pin,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODULE_LABELS, onboardingNeeded } from "@/lib/community-experience";
import type { CommunityExperience } from "@/types/community-experience";
import type { Channel, Server, VoiceParticipant } from "@/types";
export function CommunityHome({
  server,
  data,
  channels,
  participants,
  onChannel,
  onOnboarding,
  onSettings,
  events,
  reportNotice,
  progression,
  appearance = {},
  evolutionTools,
}: {
  appearance?: Appearance;
  evolutionTools?: ReactNode;
  progression?: ReactNode;
  events?: ReactNode;
  reportNotice?: ((id: string) => ReactNode) | undefined;
  server: Server;
  data: CommunityExperience;
  channels: Channel[];
  participants: Record<string, VoiceParticipant[]>;
  onChannel: (id: string) => void;
  onOnboarding: () => void;
  onSettings?: (() => void) | undefined;
}) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const config = data.experience,
    banner = config.banner_url ?? server.banner_url;
  const featured = channels.filter((c) => config.featured_channels.includes(c.id));
  const active = channels.filter(
    (c) => c.type === "voice" && (participants[c.id]?.length ?? 0) > 0,
  );
  return (
    <div
      style={appearanceStyle(appearance)}
      className="scrollbar-slim bg-background flex-1 min-w-0 overflow-y-auto"
    >
      <div className="mx-auto w-full max-w-6xl space-y-7 p-4 md:p-8">
        <section
          className={
            "relative isolate overflow-hidden rounded-3xl border bg-surface " +
            (appearance.frame ? "border-primary" : "border-primary/20")
          }
        >
          <CommunityBanner appearance={appearance} />
          {!appearance.banner && banner && failedBanner !== banner ? (
            <img
              src={banner}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedBanner(banner)}
              className="absolute inset-0 -z-10 h-full w-full object-cover opacity-35"
            />
          ) : (
            !appearance.banner && (
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-background to-secondary/20" />
            )
          )}
          <div className="bg-gradient-to-t from-background/95 to-transparent p-6 md:p-10">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <span className="flex flex-wrap items-center gap-2 rounded-full border border-primary/30 bg-background/70 px-3 py-1 text-xs text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Comunidade LobbyX
                <CommunitySeal appearance={appearance} />
              </span>
              {onSettings && (
                <Button variant="outline" size="sm" onClick={onSettings}>
                  Personalizar
                </Button>
              )}
            </div>
            {evolutionTools && <div className="mb-5">{evolutionTools}</div>}
            <div className="flex items-center gap-4">
              {server.icon_url && (
                <img src={server.icon_url} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              )}
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Seu squad tem um lugar
                </p>
                <h1 className="mt-1 break-words text-3xl font-bold md:text-4xl">{server.name}</h1>
              </div>
            </div>
            <p className="mt-5 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
              {config.intro ||
                server.description ||
                "Um espaço para conversar, compartilhar e reunir a comunidade."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-3 py-1">
                {server.visibility === "private" ? "Ingresso por convite" : "Servidor público"}
              </span>
              <span className="rounded-full border border-border px-3 py-1">
                {data.rules.length} {data.rules.length === 1 ? "regra" : "regras"} da comunidade
              </span>
            </div>
          </div>
        </section>
        {appearance.highlight && (
          <div aria-hidden="true" className="h-1 w-20 rounded-full bg-secondary" />
        )}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <h2 className="font-semibold">
                {onboardingNeeded(data) ? "Comece por aqui" : "Você faz parte desta comunidade"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {onboardingNeeded(data)
                  ? "Conheça as regras, encontre seus interesses e escolha como participar."
                  : "Reveja suas preferências de boas-vindas quando quiser."}
              </p>
            </div>
          </div>
          <Button onClick={onOnboarding}>
            {onboardingNeeded(data) ? "Conhecer comunidade" : "Rever boas-vindas"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
        {progression}
        <div className="grid gap-6 lg:grid-cols-2">
          {config.modules.map((module) => (
            <section
              key={module}
              className={
                "rounded-2xl border border-border bg-surface/60 p-5 " +
                (module === "notices" ? "lg:col-span-2" : "")
              }
            >
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                {module === "notices" ? (
                  <Pin className="h-4 w-4 text-primary" />
                ) : module === "voice" ? (
                  <Radio className="h-4 w-4 text-primary" />
                ) : module === "events" ? (
                  <CalendarDays className="h-4 w-4 text-primary" />
                ) : module === "channels" ? (
                  <Hash className="h-4 w-4 text-primary" />
                ) : (
                  <Users className="h-4 w-4 text-primary" />
                )}
                {MODULE_LABELS[module]}
              </h2>
              {module === "notices" &&
                (config.notices.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {config.notices.map((n) => (
                      <article
                        key={n.id}
                        className="rounded-xl border border-border bg-background/60 p-4"
                      >
                        <h3 className="break-words font-medium">{n.title}</h3>
                        {reportNotice?.(n.id)}
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {n.body}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum aviso fixado pela administração.
                  </p>
                ))}
              {module === "voice" &&
                (active.length ? (
                  <div className="space-y-2">
                    {active.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onChannel(c.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-border p-3 text-left hover:bg-surface-hover"
                      >
                        <span className="min-w-0 truncate text-sm">{c.name}</span>
                        <span className="shrink-0 text-xs text-success">
                          {participants[c.id]?.length} na sala · Ver sala
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma sala ativa observada entre os canais que você pode ver.
                  </p>
                ))}
              {module === "channels" &&
                (featured.length ? (
                  <div className="space-y-2">
                    {featured.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => onChannel(c.id)}
                        className="flex w-full items-center gap-2 rounded-xl border border-border p-3 text-left text-sm hover:bg-surface-hover"
                      >
                        <Hash className="h-4 w-4 shrink-0 text-primary" />
                        <span className="min-w-0 truncate">{c.name}</span>
                        <ArrowRight className="ml-auto h-4 w-4 shrink-0" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum canal em destaque disponível para você.
                  </p>
                ))}
              {module === "interests" &&
                (data.interests.length ? (
                  <div className="flex flex-wrap gap-2">
                    {data.interests.map((i) => (
                      <span
                        key={i}
                        className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary"
                      >
                        {i}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    A comunidade ainda não definiu seus interesses.
                  </p>
                ))}
              {module === "events" &&
                (events ?? (
                  <p className="text-sm text-muted-foreground">
                    Eventos indisponíveis nesta prévia.
                  </p>
                ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
