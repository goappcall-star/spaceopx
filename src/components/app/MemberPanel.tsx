import { StatusDot } from "@/components/app/StatusDot";
import { GamePresenceLine } from "@/components/gamer/GamePresenceLine";
import { useState } from "react";
import { MemberActions } from "./MemberActions";
import { useAuth } from "@/hooks/use-auth";
import { useServerAbilities } from "@/hooks/use-server-admin";
import { groupMembersByRole, memberAliasKey } from "@/lib/member-groups";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGamePresenceMap } from "@/hooks/use-gamer";
import { useGlobalPresence } from "@/hooks/use-global-presence";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/services/roles";
import type { MemberWithProfile, UserStatus, Server } from "@/types";

export function MemberPanel({
  members,
  loading,
  onStartDirect,
  server,
  onInvite,
}: {
  members: MemberWithProfile[];
  loading: boolean;
  onStartDirect?: ((conversationId: string) => void) | undefined;
  server: Server;
  onInvite?: (() => void) | undefined;
}) {
  const { statusOf, games } = useGlobalPresence();
  const { user } = useAuth();
  const abilities = useServerAbilities(server, members, user?.id);
  const [, refreshAliases] = useState(0);
  // Single batched query + realtime for the whole list — no per-member fetch.
  const gamePresence = useGamePresenceMap(members.map((m) => m.user_id));

  const groups = groupMembersByRole(members);

  const renderMember = (member: MemberWithProfile) => {
    const topRole = member.roles[0];
    let alias = "";
    try {
      alias = localStorage.getItem(memberAliasKey(user?.id, member.user_id)) ?? "";
    } catch {
      /* Local names are optional. */
    }
    const name = alias || member.nickname || member.profile?.display_name || "Usuário";
    const status: UserStatus = statusOf(member.user_id);
    const game = gamePresence[member.user_id];
    return (
      <li key={member.id}>
        <MemberActions
          member={member}
          server={server}
          onStartDirect={onStartDirect}
          onInvite={onInvite}
          onAliasChange={() => refreshAliases((value) => value + 1)}
          canManageRoles={abilities.can("manage_roles")}
          canManageMembers={abilities.can("manage_server")}
          canKick={abilities.can("kick_members")}
          canBan={abilities.can("ban_members")}
        >
          <button
            type="button"
            className={cn(
              "hover:bg-surface-hover flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-all duration-150",
              status === "offline" && "opacity-55 hover:opacity-100",
            )}
          >
            <div className="relative shrink-0">
              <Avatar frame={member.profile?.avatar_frame} className="ring-border h-8 w-8 ring-1">
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
              {game || games[member.user_id] ? (
                <GamePresenceLine userId={member.user_id} presence={game} />
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
        </MemberActions>
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
        {!loading &&
          groups.map((group) => (
            <li key={group.role?.id ?? "unassigned"}>
              <h4
                className="text-caption px-2 pt-4 pb-1"
                style={group.role?.color ? { color: group.role.color } : undefined}
              >
                {group.role ? roleLabel(group.role.name) : "Sem cargo"} — {group.members.length}
              </h4>
              <ul className="space-y-0.5">{group.members.map(renderMember)}</ul>
            </li>
          ))}
      </ul>
    </aside>
  );
}
