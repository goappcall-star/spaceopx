import { StatusDot } from "@/components/app/StatusDot";
import { GamePresenceLine } from "@/components/gamer/GamePresenceLine";
import { useProfileDialog } from "@/components/gamer/ProfileDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGamePresenceMap } from "@/hooks/use-gamer";
import type { PresenceStatus } from "@/hooks/use-presence";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/services/roles";
import type { MemberWithProfile, UserStatus } from "@/types";

export function MemberPanel({
  members,
  loading,
  presence = {},
}: {
  members: MemberWithProfile[];
  loading: boolean;
  presence?: Record<string, PresenceStatus>;
}) {
  const { openProfile } = useProfileDialog();
  // Single batched query + realtime for the whole list — no per-member fetch.
  const gamePresence = useGamePresenceMap(members.map((m) => m.user_id));

  const online = members.filter((m) => presence[m.user_id]);
  const offline = members.filter((m) => !presence[m.user_id]);

  const renderMember = (member: MemberWithProfile) => {
    const topRole = member.roles[0];
    const name = member.nickname ?? member.profile?.display_name ?? "Usuário";
    const status: UserStatus = (presence[member.user_id] as UserStatus) ?? "offline";
    const game = gamePresence[member.user_id];
    return (
      <li key={member.id}>
        <button
          type="button"
          onClick={() => openProfile(member.user_id)}
          className={cn(
            "hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-all duration-150",
            status === "offline" && "opacity-55 hover:opacity-100",
          )}
        >
          <div className="relative shrink-0">
            <Avatar className="ring-border h-8 w-8 ring-1">
              <AvatarImage src={member.profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-surface-elevated text-xs">
                {name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <StatusDot
              status={status}
              playing={Boolean(game)}
              className="border-surface absolute -right-0.5 -bottom-0.5 border-2"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-medium"
              style={topRole?.color ? { color: topRole.color } : undefined}
            >
              {name}
            </p>
            {game ? (
              <GamePresenceLine presence={game} />
            ) : (
              <p className="text-muted-foreground truncate text-xs">
                {member.profile?.custom_status
                  ? member.profile.custom_status
                  : topRole
                    ? roleLabel(topRole.name)
                    : `@${member.profile?.username ?? ""}`}
              </p>
            )}
          </div>
        </button>
      </li>
    );
  };

  return (
    <aside className="bg-surface border-border hidden w-64 shrink-0 flex-col border-l lg:flex">
      <div className="border-border flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h3 className="text-sm font-semibold tracking-tight">Membros</h3>
        <span className="bg-surface-elevated text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
          {members.length}
        </span>
      </div>
      <ul className="scrollbar-slim flex-1 space-y-0.5 overflow-y-auto p-2">
        {loading &&
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-2.5 p-1.5">
              <span className="bg-surface-elevated shimmer h-8 w-8 rounded-full" />
              <span className="bg-surface-elevated shimmer h-3 w-24 rounded" />
            </li>
          ))}
        {online.length > 0 && (
          <li className="text-caption px-2 pt-1 pb-1">Online — {online.length}</li>
        )}
        {online.map(renderMember)}
        {offline.length > 0 && (
          <li className="text-caption px-2 pt-4 pb-1">Offline — {offline.length}</li>
        )}
        {offline.map(renderMember)}
      </ul>
    </aside>
  );
}

