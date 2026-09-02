import { useQueryClient } from "@tanstack/react-query";
import { Check, Gamepad2, MessageSquare, Phone, UserCheck, UserPlus, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { STATUS_LABEL, StatusDot } from "@/components/app/StatusDot";
import { BadgeChips } from "@/components/gamer/BadgeChips";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useOptionalCall } from "@/hooks/use-call";
import { usePublicProfile } from "@/hooks/use-gamer";
import { useGlobalPresence } from "@/hooks/use-global-presence";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRelationship } from "@/hooks/use-social";
import { conversationsService, friendsService } from "@/services/social";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

/**
 * Compact profile popover. Opens on hover (desktop) or tap (mobile) — the same
 * gamer profile used everywhere, never a separate identity.
 */
export function QuickProfile({
  userId,
  roles,
  children,
  side = "right",
  align = "start",
  className,
  onStartDirect,
}: {
  userId: string;
  roles?: Role[];
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
  onStartDirect?: ((conversationId: string) => void) | undefined;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleOpen() {
    if (isMobile) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 320);
  }

  function scheduleClose() {
    if (isMobile) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 200);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          className={cn("block", className)}
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        onMouseEnter={() => timer.current && clearTimeout(timer.current)}
        onMouseLeave={scheduleClose}
        onOpenAutoFocus={(event) => !isMobile && event.preventDefault()}
        className="glass-panel w-80 overflow-hidden p-0"
      >
        <QuickProfileCard
          userId={userId}
          roles={roles}
          onDone={() => setOpen(false)}
          onStartDirect={onStartDirect}
        />
      </PopoverContent>
    </Popover>
  );
}

function QuickProfileCard({
  userId,
  roles,
  onDone,
  onStartDirect,
}: {
  userId: string;
  roles?: Role[];
  onDone: () => void;
  onStartDirect?: ((conversationId: string) => void) | undefined;
}) {
  const { data, isLoading } = usePublicProfile(userId);
  const { statusOf } = useGlobalPresence();

  if (isLoading || !data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  const { profile, presence, badges, sharedServers } = data;
  const status = statusOf(profile.id);

  return (
    <div className="max-h-[70vh] overflow-y-auto">
      <div
        className="bg-brand-gradient h-16 w-full bg-cover bg-center"
        style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}
      />
      <div className="px-4 pb-4">
        <div className="relative -mt-8 w-fit">
          <Avatar className="border-surface glow-ring h-16 w-16 border-4">
            <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-secondary">
              {profile.display_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <StatusDot
            status={status}
            className="border-surface absolute right-0 bottom-0 h-4 w-4 border-2"
          />
        </div>

        <p className="mt-2 text-base leading-tight font-semibold">{profile.display_name}</p>
        <p className="text-muted-foreground font-mono text-xs">@{profile.username}</p>

        <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <StatusDot status={status} className="h-2.5 w-2.5" />
          {STATUS_LABEL[status]}
        </p>
        {presence?.game && (
          <p className="text-primary mt-1 flex items-center gap-1.5 text-xs">
            <Gamepad2 className="h-3.5 w-3.5" /> {presence.game.name}
          </p>
        )}

        {profile.custom_status && (
          <p className="text-surface-foreground mt-2 text-xs italic">“{profile.custom_status}”</p>
        )}
        {profile.bio && (
          <p className="mt-2 line-clamp-4 text-xs whitespace-pre-wrap">{profile.bio}</p>
        )}

        {roles && roles.length > 0 && (
          <div className="mt-3">
            <p className="text-caption mb-1.5">Cargos</p>
            <ul className="flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className="border-border/70 bg-surface flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: role.color }}
                  />
                  {role.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {badges.length > 0 && (
          <div className="mt-3">
            <p className="text-caption mb-1.5">Badges</p>
            <BadgeChips badges={badges} />
          </div>
        )}

        {sharedServers.length > 0 && (
          <div className="mt-3">
            <p className="text-caption mb-1.5">Servidores em comum</p>
            <ul className="flex flex-wrap gap-1.5">
              {sharedServers.slice(0, 6).map((server) => (
                <li
                  key={server.id}
                  className="border-border/70 bg-surface rounded-full border px-2 py-0.5 text-[11px]"
                >
                  {server.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <QuickActions
          userId={profile.id}
          peer={{
            id: profile.id,
            display_name: profile.display_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
          }}
          onDone={onDone}
          onStartDirect={onStartDirect}
        />
      </div>
    </div>
  );
}

function QuickActions({
  userId,
  peer,
  onDone,
  onStartDirect,
}: {
  userId: string;
  peer: { id: string; display_name: string; username: string; avatar_url: string | null };
  onDone: () => void;
  onStartDirect?: ((conversationId: string) => void) | undefined;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: relationship } = useRelationship(userId);
  const call = useOptionalCall();

  if (user?.id === userId) return null;

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

  async function openMessage() {
    try {
      const conversationId = await conversationsService.openDirect(userId);
      refresh();
      onDone();
      onStartDirect?.(conversationId);
    } catch {
      toast.error("Não foi possível abrir a conversa.");
    }
  }

  if (relationship?.state === "blocked_me" || relationship?.state === "blocked_by_me") {
    return <p className="text-muted-foreground mt-3 text-xs">Este usuário está indisponível.</p>;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      <Button size="sm" onClick={openMessage}>
        <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
        Mensagem
      </Button>

      {relationship?.state === "none" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => friendsService.sendRequest(userId), "Solicitação enviada.")}
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Adicionar amigo
        </Button>
      )}
      {relationship?.state === "request_sent" && (
        <Button size="sm" variant="outline" disabled>
          Solicitação enviada
        </Button>
      )}
      {relationship?.state === "request_received" && relationship.friendshipId && (
        <>
          <Button
            size="sm"
            variant="outline"
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
            variant="ghost"
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
      {relationship?.state === "friends" && (
        <Button size="sm" variant="outline" disabled>
          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
          Amigos
        </Button>
      )}

      {call && (
        <Button
          size="sm"
          variant="secondary"
          disabled={Boolean(call.busyUsers[userId])}
          onClick={() => {
            onDone();
            void call.startCall(peer, false);
          }}
        >
          <Phone className="mr-1.5 h-3.5 w-3.5" />
          Chamada
        </Button>
      )}
    </div>
  );
}
