import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Gamepad2 } from "lucide-react";

import { STATUS_EMOJI, STATUS_LABEL } from "@/components/app/StatusDot";
import { BadgeChips } from "@/components/gamer/BadgeChips";
import { XpBar } from "@/components/gamer/XpBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicProfile } from "@/hooks/use-gamer";

interface ProfileDialogContextValue {
  openProfile: (userId: string) => void;
}

const ProfileDialogContext = createContext<ProfileDialogContextValue | undefined>(undefined);

export function useProfileDialog() {
  const ctx = useContext(ProfileDialogContext);
  return ctx ?? { openProfile: () => undefined };
}

export function ProfileDialogProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const value = useMemo(() => ({ openProfile: (id: string) => setUserId(id) }), []);

  return (
    <ProfileDialogContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(userId)} onOpenChange={(open) => !open && setUserId(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <ProfileDialogBody userId={userId} />
        </DialogContent>
      </Dialog>
    </ProfileDialogContext.Provider>
  );
}

function ProfileDialogBody({ userId }: { userId: string | null }) {
  const { data, isLoading } = usePublicProfile(userId);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-6">
        <DialogTitle className="sr-only">Perfil</DialogTitle>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  const { profile, presence, favorites, xp, badges, sharedServers } = data;

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      <div
        className="bg-brand-gradient h-28 w-full bg-cover bg-center"
        style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
      />
      <div className="px-6 pb-6">
        <Avatar className="border-surface glow-ring -mt-10 h-20 w-20 border-4">
          <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-secondary text-lg">
            {profile.display_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <DialogTitle className="mt-3 text-xl">{profile.display_name}</DialogTitle>
        <p className="text-muted-foreground font-mono text-sm">@{profile.username}</p>

        <p className="mt-2 text-xs">
          {presence?.game ? (
            <span className="text-primary inline-flex items-center gap-1.5">
              <Gamepad2 className="h-3.5 w-3.5" /> Jogando {presence.game.name}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {STATUS_EMOJI[profile.status]} {STATUS_LABEL[profile.status]}
            </span>
          )}
        </p>

        {profile.custom_status && (
          <p className="text-surface-foreground mt-2 text-sm italic">“{profile.custom_status}”</p>
        )}

        {profile.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{profile.bio}</p>}

        <div className="glass-panel mt-5 p-4">
          <XpBar xp={xp.xp} level={xp.level} />
        </div>

        <Section title="Jogos favoritos">
          {favorites.length === 0 ? (
            <p className="text-muted-foreground text-xs">Nenhum jogo favorito.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {favorites.map((fav) => (
                <li
                  key={fav.id}
                  className="bg-surface border-border flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs"
                >
                  <Gamepad2 className="text-primary h-3.5 w-3.5" />
                  {fav.game?.name}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Badges">
          <BadgeChips badges={badges} />
        </Section>

        <Section title="Servidores em comum">
          {sharedServers.length === 0 ? (
            <p className="text-muted-foreground text-xs">Nenhum servidor em comum.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {sharedServers.map((server) => (
                <li
                  key={server.id}
                  className="bg-surface border-border rounded-lg border px-2.5 py-1.5 text-xs"
                >
                  {server.name}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
