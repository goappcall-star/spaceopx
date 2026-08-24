import type { MemberWithProfile, RolePermissions } from "@/types";

export type ServerPermission =
  | "administrator"
  | "manage_server"
  | "manage_channels"
  | "manage_roles"
  | "manage_members"
  | "create_invite"
  | "kick_members"
  | "ban_members"
  | "manage_messages"
  | "manage_voice"
  | "view_audit_log"
  | "send_messages"
  | "read_messages";

export interface PermissionDef {
  key: ServerPermission;
  label: string;
  description: string;
  group: "Administração" | "Comunidade" | "Moderação" | "Comunicação";
}

/**
 * Catalogue of permissions. The source of truth is always the backend
 * (`has_server_permission` + RLS); this list only drives the UI.
 */
export const PERMISSION_CATALOG: PermissionDef[] = [
  {
    key: "administrator",
    label: "Administrador",
    description: "Concede todas as permissões do servidor.",
    group: "Administração",
  },
  {
    key: "manage_server",
    label: "Gerenciar servidor",
    description: "Alterar nome, descrição, ícone, banner e configurações.",
    group: "Administração",
  },
  {
    key: "manage_channels",
    label: "Gerenciar canais",
    description: "Criar, editar e excluir canais de texto e voz.",
    group: "Administração",
  },
  {
    key: "manage_roles",
    label: "Gerenciar cargos",
    description: "Criar, editar, excluir e reordenar cargos.",
    group: "Administração",
  },
  {
    key: "manage_members",
    label: "Gerenciar membros",
    description: "Atribuir e remover cargos dos membros.",
    group: "Comunidade",
  },
  {
    key: "create_invite",
    label: "Criar convites",
    description: "Gerar e revogar links de convite.",
    group: "Comunidade",
  },
  {
    key: "kick_members",
    label: "Expulsar membros",
    description: "Remover membros do servidor.",
    group: "Moderação",
  },
  {
    key: "ban_members",
    label: "Banir membros",
    description: "Banir e desbanir contas do servidor.",
    group: "Moderação",
  },
  {
    key: "manage_messages",
    label: "Gerenciar mensagens",
    description: "Apagar mensagens de outros membros.",
    group: "Moderação",
  },
  {
    key: "manage_voice",
    label: "Gerenciar voz",
    description: "Silenciar e mover membros nos canais de voz.",
    group: "Moderação",
  },
  {
    key: "view_audit_log",
    label: "Ver registro de auditoria",
    description: "Consultar o histórico de ações administrativas.",
    group: "Moderação",
  },
  {
    key: "read_messages",
    label: "Ler mensagens",
    description: "Visualizar o conteúdo dos canais de texto.",
    group: "Comunicação",
  },
  {
    key: "send_messages",
    label: "Enviar mensagens",
    description: "Publicar mensagens nos canais de texto.",
    group: "Comunicação",
  },
];

export const PERMISSION_GROUPS = [
  "Administração",
  "Comunidade",
  "Moderação",
  "Comunicação",
] as const;

export function permissionLabel(key: string) {
  return PERMISSION_CATALOG.find((p) => p.key === key)?.label ?? key;
}

function roleGrants(permissions: RolePermissions, permission: ServerPermission) {
  if (permissions["administrator"]) return true;
  return Boolean(permissions[permission]);
}

/**
 * Mirrors the SQL `has_server_permission`. UI-only: every mutation is still
 * checked by RLS, so a tampered client simply gets a permission error.
 */
export function memberHasPermission(
  member: MemberWithProfile | undefined | null,
  ownerId: string | undefined,
  permission: ServerPermission,
) {
  if (!member) return false;
  if (ownerId && member.user_id === ownerId) return true;
  return member.roles.some((role) => roleGrants(role.permissions, permission));
}
