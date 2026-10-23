import { lazy, Suspense, useState } from "react";
import { Ban, Image as ImageIcon, Link2, ScrollText, Settings2, Shield, Users } from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { COMMUNITY_V1_ENABLED } from "@/lib/community-feature";
import { useServerRoles } from "@/hooks/use-server-admin";
import { cn } from "@/lib/utils";
import { SettingsAccess } from "./SettingsAccess";
import { SettingsAudit } from "./SettingsAudit";
import { SettingsBans } from "./SettingsBans";
import { SettingsInvites } from "./SettingsInvites";
import { SettingsMembers } from "./SettingsMembers";
import { SettingsProfile } from "./SettingsProfile";
import { SettingsRoles } from "./SettingsRoles";
import { DeleteServerButton } from "./DeleteServerButton";
import { useServerAbilities } from "@/hooks/use-server-admin";
import type { MemberWithProfile, Server } from "@/types";

const SettingsCommunity = lazy(() =>
  import("./SettingsCommunity").then((m) => ({ default: m.SettingsCommunity })),
);
const CommunityModerationConsole = lazy(() =>
  import("@/components/community/CommunityModerationConsole").then((m) => ({
    default: m.CommunityModerationConsole,
  })),
);

type SectionId =
  | "community"
  | "moderation"
  | "profile"
  | "access"
  | "members"
  | "roles"
  | "invites"
  | "bans"
  | "audit";

interface Props {
  server: Server;
  members: MemberWithProfile[];
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServerSettingsDialog({
  server,
  members,
  currentUserId,
  open,
  onOpenChange,
}: Props) {
  const { can, isOwner } = useServerAbilities(server, members, currentUserId);
  const [section, setSection] = useState<SectionId>("profile");
  const { data: moderationRoles = [] } = useServerRoles(
    open && COMMUNITY_V1_ENABLED ? server.id : "",
  );

  type SectionItem = { id: SectionId; label: string; icon: typeof Shield; group: string };
  const sections: SectionItem[] = (
    [
      { id: "community", label: "Comunidade", icon: Users, group: "Geral" },
      { id: "moderation", label: "Moderação", icon: Shield, group: "Comunidade" },
      { id: "profile", label: "Perfil do servidor", icon: ImageIcon, group: "Geral" },
      { id: "access", label: "Acesso e interações", icon: Settings2, group: "Geral" },
      { id: "members", label: "Membros", icon: Users, group: "Comunidade" },
      { id: "roles", label: "Cargos e permissões", icon: Shield, group: "Comunidade" },
      { id: "invites", label: "Convites", icon: Link2, group: "Comunidade" },
      { id: "bans", label: "Banimentos", icon: Ban, group: "Moderação" },
      { id: "audit", label: "Registro de auditoria", icon: ScrollText, group: "Moderação" },
    ] as SectionItem[]
  ).filter((item) => {
    if (item.id === "community") return COMMUNITY_V1_ENABLED;
    if (item.id === "moderation") return COMMUNITY_V1_ENABLED;
    if (item.id === "bans") return can("ban_members");
    if (item.id === "audit") return can("view_audit_log");
    if (item.id === "invites") return can("create_invite") || can("manage_server");
    return true;
  });

  const groups = [...new Set(sections.map((s) => s.group))];
  const readOnlyServer = !can("manage_server");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90dvh] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">Configurações de {server.name}</DialogTitle>
        <div className="flex h-full min-h-0 flex-col md:flex-row">
          <label className="border-border border-b p-3 pr-12 md:hidden">
            <span className="sr-only">Seção das configurações do servidor</span>
            <select
              value={section}
              onChange={(event) => setSection(event.target.value as SectionId)}
              className="bg-surface border-border h-11 w-full min-w-0 rounded-lg border px-3 text-sm"
            >
              {sections.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <nav
            aria-label="Configurações do servidor"
            className={cn(
              "bg-surface border-border scrollbar-slim w-full shrink-0 overflow-y-auto border-b p-3 md:w-56 md:border-r md:border-b-0 md:block",
              !isOwner && "max-md:hidden",
            )}
          >
            <p className="text-caption hidden truncate px-2 pt-1 pb-3 md:block">{server.name}</p>
            {groups.map((group) => (
              <div key={group} className="mb-3 hidden md:block">
                <p className="text-caption px-2 pb-1">{group}</p>
                <ul className="space-y-0.5">
                  {sections
                    .filter((s) => s.group === group)
                    .map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSection(item.id)}
                          className={cn(
                            "hover:bg-surface-hover flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            section === item.id && "bg-surface-elevated text-primary font-medium",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            {isOwner && (
              <div className="border-border md:mt-3 md:border-t md:pt-3">
                <DeleteServerButton
                  key={server.id}
                  server={server}
                  className="w-full justify-start"
                  onDeleted={() => onOpenChange(false)}
                />
              </div>
            )}
          </nav>

          <div className="scrollbar-slim min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <header className="mb-5">
              <h2 className="text-lg font-semibold tracking-tight">
                {sections.find((s) => s.id === section)?.label}
              </h2>
            </header>
            {section === "community" && open && COMMUNITY_V1_ENABLED && (
              <Suspense fallback={<p role="status">Carregando comunidade…</p>}>
                <SettingsCommunity
                  key={`${server.id}:${currentUserId}`}
                  server={server}
                  members={members}
                  currentUserId={currentUserId}
                  canEditProfile={!readOnlyServer}
                  onEditProfile={() => setSection("profile")}
                />
              </Suspense>
            )}
            {section === "profile" && <SettingsProfile server={server} readOnly={readOnlyServer} />}
            {section === "moderation" && open && COMMUNITY_V1_ENABLED && (
              <Suspense fallback={<p role="status">Carregando moderação…</p>}>
                <CommunityModerationConsole
                  key={`${server.id}:${currentUserId}`}
                  serverId={server.id}
                  userId={currentUserId}
                  people={members.map((m) => ({
                    id: m.user_id,
                    name: m.profile?.display_name ?? "Membro",
                  }))}
                  roles={moderationRoles
                    .filter((r) => !r.is_owner && !["OWNER", "MEMBER"].includes(r.name))
                    .map((r) => ({ id: r.id, name: r.name }))}
                />
              </Suspense>
            )}
            {section === "access" && <SettingsAccess server={server} readOnly={readOnlyServer} />}
            {section === "members" && (
              <SettingsMembers
                server={server}
                members={members}
                currentUserId={currentUserId}
                canManageRoles={can("manage_members") || can("manage_roles")}
                canKick={can("kick_members") || can("manage_members")}
                canBan={can("ban_members")}
              />
            )}
            {section === "roles" && (
              <SettingsRoles server={server} readOnly={!can("manage_roles")} />
            )}
            {section === "invites" && (
              <SettingsInvites server={server} canCreate={can("create_invite")} />
            )}
            {section === "bans" && <SettingsBans server={server} canUnban={can("ban_members")} />}
            {section === "audit" && <SettingsAudit server={server} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
