import { useState } from "react";
import {
  Ban,
  Image as ImageIcon,
  Link2,
  ScrollText,
  Settings2,
  Shield,
  Users,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SettingsAccess } from "./SettingsAccess";
import { SettingsAudit } from "./SettingsAudit";
import { SettingsBans } from "./SettingsBans";
import { SettingsInvites } from "./SettingsInvites";
import { SettingsMembers } from "./SettingsMembers";
import { SettingsProfile } from "./SettingsProfile";
import { SettingsRoles } from "./SettingsRoles";
import { useServerAbilities } from "@/hooks/use-server-admin";
import type { MemberWithProfile, Server } from "@/types";

type SectionId = "profile" | "access" | "members" | "roles" | "invites" | "bans" | "audit";

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
  const { can } = useServerAbilities(server, members, currentUserId);
  const [section, setSection] = useState<SectionId>("profile");

  const sections: { id: SectionId; label: string; icon: typeof Shield; group: string }[] = [
    { id: "profile", label: "Perfil do servidor", icon: ImageIcon, group: "Geral" },
    { id: "access", label: "Acesso e interações", icon: Settings2, group: "Geral" },
    { id: "members", label: "Membros", icon: Users, group: "Comunidade" },
    { id: "roles", label: "Cargos e permissões", icon: Shield, group: "Comunidade" },
    { id: "invites", label: "Convites", icon: Link2, group: "Comunidade" },
    { id: "bans", label: "Banimentos", icon: Ban, group: "Moderação" },
    { id: "audit", label: "Registro de auditoria", icon: ScrollText, group: "Moderação" },
  ].filter((item) => {
    if (item.id === "bans") return can("ban_members");
    if (item.id === "audit") return can("view_audit_log");
    if (item.id === "invites") return can("create_invite") || can("manage_server");
    return true;
  });

  const groups = [...new Set(sections.map((s) => s.group))];
  const readOnlyServer = !can("manage_server");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[85vh] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">Configurações de {server.name}</DialogTitle>
        <div className="flex h-full min-h-0">
          <nav className="bg-surface border-border scrollbar-slim hidden w-56 shrink-0 overflow-y-auto border-r p-3 sm:block">
            <p className="text-caption truncate px-2 pt-1 pb-3">{server.name}</p>
            {groups.map((group) => (
              <div key={group} className="mb-3">
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
                            section === item.id &&
                              "bg-surface-elevated text-primary font-medium",
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
          </nav>

          <div className="scrollbar-slim min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <header className="mb-5">
              <h2 className="text-lg font-semibold tracking-tight">
                {sections.find((s) => s.id === section)?.label}
              </h2>
            </header>
            {section === "profile" && (
              <SettingsProfile server={server} readOnly={readOnlyServer} />
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
            {section === "bans" && (
              <SettingsBans server={server} canUnban={can("ban_members")} />
            )}
            {section === "audit" && <SettingsAudit server={server} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
