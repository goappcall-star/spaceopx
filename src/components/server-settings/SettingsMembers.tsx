import { useMemo, useState } from "react";
import { Ban, Check, Search, Shield, UserMinus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAdminMutation, useServerRoles } from "@/hooks/use-server-admin";
import { roleLabel } from "@/services/roles";
import { serverAdminService } from "@/services/server-admin";
import type { MemberWithProfile, Server } from "@/types";

interface Props {
  server: Server;
  members: MemberWithProfile[];
  currentUserId: string;
  canManageRoles: boolean;
  canKick: boolean;
  canBan: boolean;
}

export function SettingsMembers({
  server,
  members,
  currentUserId,
  canManageRoles,
  canKick,
  canBan,
}: Props) {
  const [query, setQuery] = useState("");
  const { data: roles } = useServerRoles(server.id);
  const invalidate = [
    ["members", server.id],
    ["server-bans", server.id],
    ["audit-logs", server.id],
  ];

  const setRoles = useAdminMutation(
    (vars: { memberId: string; next: string[]; current: string[] }) =>
      serverAdminService.setMemberRoles(vars.memberId, vars.next, vars.current),
    { success: "Cargos atualizados.", invalidate },
  );

  const kick = useAdminMutation((memberId: string) => serverAdminService.kickMember(memberId), {
    success: "Membro removido do servidor.",
    invalidate,
  });

  const ban = useAdminMutation(
    (userId: string) => serverAdminService.banMember(server.id, userId, null, currentUserId),
    { success: "Membro banido.", invalidate },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.profile?.username ?? "").toLowerCase().includes(q) ||
        (m.profile?.display_name ?? "").toLowerCase().includes(q) ||
        (m.nickname ?? "").toLowerCase().includes(q),
    );
  }, [members, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar membro"
          className="pl-9"
        />
      </div>

      <ul className="border-border divide-border bg-surface divide-y rounded-xl border">
        {filtered.map((member) => {
          const isOwner = member.user_id === server.owner_id;
          const isSelf = member.user_id === currentUserId;
          const name = member.nickname ?? member.profile?.display_name ?? "Usuário";
          const currentRoleIds = member.roles.map((r) => r.id);
          return (
            <li key={member.id} className="flex items-center gap-3 p-3">
              <Avatar className="ring-border h-9 w-9 ring-1">
                <AvatarImage src={member.profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-surface-elevated text-xs">
                  {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {name}
                  {isOwner && <span className="text-primary ml-2 text-[11px]">Proprietário</span>}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  @{member.profile?.username ?? "—"}
                  {member.roles.length > 0 &&
                    ` · ${member.roles.map((r) => roleLabel(r.name)).join(", ")}`}
                </p>
              </div>

              {canManageRoles && !isOwner && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" aria-label={`Cargos de ${name}`}>
                      <Shield className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Cargos</DropdownMenuLabel>
                    {(roles ?? [])
                      .filter((role) => role.name !== "OWNER")
                      .map((role) => {
                        const checked = currentRoleIds.includes(role.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={role.id}
                            checked={checked}
                            onCheckedChange={(value) =>
                              setRoles.mutate({
                                memberId: member.id,
                                current: currentRoleIds,
                                next: value
                                  ? [...currentRoleIds, role.id]
                                  : currentRoleIds.filter((id) => id !== role.id),
                              })
                            }
                          >
                            <span className={cn(checked && "font-medium")}>
                              {roleLabel(role.name)}
                            </span>
                            {checked && <Check className="ml-auto h-3.5 w-3.5" />}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {canKick && !isOwner && !isSelf && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Expulsar ${name}`}
                  disabled={kick.isPending}
                  onClick={() => kick.mutate(member.id)}
                >
                  <UserMinus className="h-4 w-4" />
                </Button>
              )}
              {canBan && !isOwner && !isSelf && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Banir ${name}`}
                  disabled={ban.isPending}
                  onClick={() => ban.mutate(member.user_id)}
                >
                  <Ban className="text-destructive h-4 w-4" />
                </Button>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="text-muted-foreground p-6 text-center text-sm">Nenhum membro.</li>
        )}
      </ul>
    </div>
  );
}
