import { StatusDot } from "@/components/app/StatusDot";
import { GamePresenceLine } from "@/components/gamer/GamePresenceLine";
import { useProfileDialog } from "@/components/gamer/ProfileDialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGamePresenceMap } from "@/hooks/use-gamer";
import type { PresenceStatus } from "@/hooks/use-presence";
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
          className="hover:bg-accent/50 flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors"
        >
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={member.profile?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-secondary text-xs">
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
            <p className="truncate text-sm font-medium">{name}</p>
            {game ? (
              <GamePresenceLine presence={game} />
            ) : (
              <p className="text-muted-foreground truncate text-xs">
                {member.profile?.custom_status ? (
                  member.profile.custom_status
                ) : topRole ? (
                  <span style={{ color: topRole.color }}>{roleLabel(topRole.name)}</span>
                ) : (
                  `@${member.profile?.username ?? ""}`
                )}
              </p>
            )}
          </div>
        </button>
      </li>
    );
  };

  return (
    <aside className="bg-surface border-border hidden w-64 shrink-0 flex-col border-l lg:flex">
      <div className="border-border border-b p-4">
        <h3 className="text-sm font-semibold">Membros</h3>
        <p className="text-muted-foreground text-xs">{members.length} no servidor</p>
      </div>
      <ul className="scrollbar-slim flex-1 space-y-1 overflow-y-auto p-2">
        {loading && <li className="text-muted-foreground p-2 text-sm">Carregando...</li>}
        {online.length > 0 && (
          <li className="text-muted-foreground px-2 pt-1 text-[11px] font-semibold tracking-wider uppercase">
            Online — {online.length}
          </li>
        )}
        {online.map(renderMember)}
        {offline.length > 0 && (
          <li className="text-muted-foreground px-2 pt-3 text-[11px] font-semibold tracking-wider uppercase">
            Offline — {offline.length}
          </li>
        )}
        {offline.map(renderMember)}
      </ul>
    </aside>
  );
}
