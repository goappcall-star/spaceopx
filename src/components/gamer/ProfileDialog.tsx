import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Gamepad2, MessageSquare, UserCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { STATUS_EMOJI, STATUS_LABEL } from "@/components/app/StatusDot";
import { BadgeChips } from "@/components/gamer/BadgeChips";
import { XpBar } from "@/components/gamer/XpBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicProfile } from "@/hooks/use-gamer";
import { useRelationship } from "@/hooks/use-social";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { blocksService, conversationsService, friendsService } from "@/services/social";

interface ProfileDialogContextValue {
  openProfile: (userId: string) => void;
}

const ProfileDialogContext = createContext<ProfileDialogContextValue | undefined>(undefined);

export function useProfileDialog() {
  const ctx = useContext(ProfileDialogContext);
  return ctx ?? { openProfile: () => undefined };
}

export function ProfileDialogProvider({
  children,
  onStartDirect,
}: {
  children: ReactNode;
  onStartDirect?: ((conversationId: string) => void) | undefined;
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const value = useMemo(() => ({ openProfile: (id: string) => setUserId(id) }), []);

  return (
    <ProfileDialogContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(userId)} onOpenChange={(open) => !open && setUserId(null)}>
        <DialogContent className="max-w-lg overflow-hidden p-0">
          <ProfileDialogBody
            userId={userId}
            onStartDirect={(conversationId) => {
              setUserId(null);
              onStartDirect?.(conversationId);
            }}
          />
        </DialogContent>
      </Dialog>
    </ProfileDialogContext.Provider>
  );
}

function ProfileDialogBody({
  userId,
  onStartDirect,
}: {
  userId: string | null;
  onStartDirect?: ((conversationId: string) => void) | undefined;
}) {
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

        <SocialActions userId={profile.id} onStartDirect={onStartDirect} />

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

function SocialActions({
  userId,
  onStartDirect,
}: {
  userId: string;
  onStartDirect?: ((conversationId: string) => void) | undefined;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: relationship } = useRelationship(userId);
  const isSelf = user?.id === userId;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["relationship", userId] });
    void queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });
    void queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
  }

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      toast.success(message);
      refresh();
    } catch {
      toast.error("Ação não concluída.");
    }
  }

  async function message() {
    try {
      const conversationId = await conversationsService.openDirect(userId);
      refresh();
      onStartDirect?.(conversationId);
    } catch {
      toast.error("Não foi possível abrir a conversa.");
    }
  }

  if (isSelf) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/settings/profile">Editar perfil</Link>
        </Button>
      </div>
    );
  }

  if (!relationship) return null;

  if (relationship.state === "blocked_me") {
    return <p className="text-muted-foreground mt-3 text-xs">Este usuário está indisponível.</p>;
  }

  if (relationship.state === "blocked_by_me") {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => blocksService.unblock(userId), "Usuário desbloqueado.")}
        >
          Desbloquear
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {relationship.state === "none" && (
        <Button
          size="sm"
          onClick={() => run(() => friendsService.sendRequest(userId), "Solicitação enviada.")}
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Adicionar amigo
        </Button>
      )}
      {relationship.state === "request_sent" && (
        <Button size="sm" variant="outline" disabled>
          Solicitação enviada
        </Button>
      )}
      {relationship.state === "request_received" && relationship.friendshipId && (
        <>
          <Button
            size="sm"
            onClick={() =>
              run(
                () => friendsService.respond(relationship.friendshipId!, "accept"),
                "Solicitação aceita.",
              )
            }
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Aceitar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              run(
                () => friendsService.respond(relationship.friendshipId!, "decline"),
                "Solicitação recusada.",
              )
            }
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Recusar
          </Button>
        </>
      )}
      {relationship.state === "friends" && (
        <Button size="sm" variant="outline" disabled>
          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
          Amigos
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={message}>
        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
        Mensagem
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="hover:text-destructive"
        onClick={() => run(() => blocksService.block(userId), "Usuário bloqueado.")}
      >
        <Ban className="mr-1.5 h-3.5 w-3.5" />
        Bloquear
      </Button>
    </div>
  );
}
