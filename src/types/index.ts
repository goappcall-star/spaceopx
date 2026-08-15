export type UserStatus = "online" | "idle" | "offline";

export type ChannelType = "text" | "voice" | "announcement" | "forum";

export type RoleName = "OWNER" | "ADMIN" | "MEMBER" | (string & {});

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Server {
  id: string;
  owner_id: string;
  name: string;
  icon_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServerMember {
  id: string;
  server_id: string;
  user_id: string;
  nickname: string | null;
  joined_at: string;
  created_at: string;
}

/** Permissions live in JSONB so the model can grow without migrations. */
export interface RolePermissions {
  administrator?: boolean;
  manage_server?: boolean;
  manage_roles?: boolean;
  manage_channels?: boolean;
  manage_members?: boolean;
  create_invite?: boolean;
  send_messages?: boolean;
  read_messages?: boolean;
  [key: string]: boolean | undefined;
}

export interface Role {
  id: string;
  server_id: string;
  name: RoleName;
  color: string;
  position: number;
  permissions: RolePermissions;
  created_at: string;
}

export interface MemberRole {
  id: string;
  member_id: string;
  role_id: string;
  created_at: string;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ServerInvite {
  id: string;
  server_id: string;
  code: string;
  created_by: string;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  created_at: string;
}

/** A member joined with its profile and roles, ready for the UI. */
export interface MemberWithProfile extends ServerMember {
  profile: Profile | null;
  roles: Role[];
}

export interface InvitePreview {
  server_id: string | null;
  server_name: string | null;
  server_icon_url: string | null;
  server_description: string | null;
  member_count: number;
  already_member: boolean;
  valid: boolean;
  reason: string;
}

/* ---------------------------------------------------------------- Fase 2/3 */

export type PermissionKey =
  | "view_channel"
  | "send_messages"
  | "connect"
  | "speak"
  | "mute_members"
  | "deafen_members"
  | "move_members"
  | "manage_channel";

export interface Attachment {
  path: string;
  name: string;
  size: number;
  mime: string;
  kind: "image" | "file";
}

export interface Message {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  reply_to_id: string | null;
  attachments: Attachment[];
  mentions: string[];
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface MessageWithMeta extends Message {
  author: Profile | null;
  reactions: ReactionGroup[];
  replyTo: { id: string; content: string; author: Profile | null } | null;
}

export interface ChannelReadState {
  id: string;
  channel_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string;
  updated_at: string;
}

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export interface VoiceParticipant {
  user_id: string;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
}
