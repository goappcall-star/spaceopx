import { StatusDot } from "@/components/app/StatusDot";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { roleLabel } from "@/services/roles";
import type { MemberWithProfile } from "@/types";

export function MemberPanel({
  members,
  loading,
}: {
  members: MemberWithProfile[];
  loading: boolean;
}) {
  return (
    <aside className="bg-surface border-border hidden w-64 shrink-0 flex-col border-l lg:flex">
      <div className="border-border border-b p-4">
        <h3 className="text-sm font-semibold">Membros</h3>
        <p className="text-muted-foreground text-xs">{members.length} no servidor</p>
      </div>
      <ul className="scrollbar-slim flex-1 space-y-1 overflow-y-auto p-2">
        {loading && <li className="text-muted-foreground p-2 text-sm">Carregando...</li>}
        {members.map((member) => {
          const topRole = member.roles[0];
          const name = member.nickname ?? member.profile?.display_name ?? "Usuário";
          return (
            <li key={member.id} className="hover:bg-accent/50 flex items-center gap-2.5 rounded-md p-2">
              <div className="relative">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-secondary text-xs">
                    {name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <StatusDot
                  status={member.profile?.status ?? "offline"}
                  className="border-surface absolute -right-0.5 -bottom-0.5 border-2"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {topRole ? (
                    <span style={{ color: topRole.color }}>{roleLabel(topRole.name)}</span>
                  ) : (
                    `@${member.profile?.username ?? ""}`
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
