export type UserStatus = "online" | "idle" | "dnd" | "offline";

export type AccentColor =
  | "neon_red"
  | "neon_purple"
  | "neon_blue"
  | "neon_green"
  | "neon_cyan"
  | "neon_orange";

export type TransparencyLevel = "none" | "low" | "medium" | "high";

export type ChannelType = "text" | "voice" | "announcement" | "forum";

export type RoleName = "OWNER" | "ADMIN" | "MEMBER" | (string & {});

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  custom_status: string | null;
  accent_color: AccentColor;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  cover_url: string | null;
  created_at: string;
}

export interface FavoriteGame {
  id: string;
  user_id: string;
  game_id: string;
  position: number;
  created_at: string;
  game: Game | null;
}

export type GamePresenceStatus = "playing" | "paused" | "stopped";

export interface GamePresence {
  user_id: string;
  game_id: string | null;
  status: GamePresenceStatus;
  started_at: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
  game: Game | null;
}

export interface UserXp {
  user_id: string;
  xp: number;
  level: number;
  updated_at: string;
}

export interface Badge {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  rarity: "common" | "rare" | "epic" | "legendary";
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
  badge: Badge | null;
}

export type AudioInputMode = "open" | "ptt";

export interface UserPreferences {
  user_id: string;
  accent_color: AccentColor;
  glow_enabled: boolean;
  animations_enabled: boolean;
  sounds_enabled: boolean;
  transparency_level: TransparencyLevel;
  input_device_id: string | null;
  output_device_id: string | null;
  input_volume: number;
  output_volume: number;
  input_mode: AudioInputMode;
  ptt_key: string;
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
  /** Camera track published (Fase 6). */
  camera?: boolean;
  /** Screen share track published (Fase 6). */
  screen?: boolean;
}

/* ------------------------------------------------------------------ Fase 5 */

export type FriendshipStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendEntry {
  friendshipId: string;
  profile: Profile;
  presence: GamePresence | null;
}

export interface FriendRequestEntry {
  friendshipId: string;
  profile: Profile;
  direction: "incoming" | "outgoing";
  created_at: string;
}

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export type RelationshipState =
  | "self"
  | "none"
  | "friends"
  | "request_sent"
  | "request_received"
  | "blocked_by_me"
  | "blocked_me";

export interface Relationship {
  state: RelationshipState;
  friendshipId: string | null;
}

export type ConversationType = "direct" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
}

export interface ConversationOverview {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  owner_id: string | null;
  updated_at: string;
  last_read_at: string;
  other_user_id: string | null;
  member_count: number;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender: string | null;
  unread_count: number;
  otherProfile?: Profile | null;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  reply_to_id: string | null;
  attachments: Attachment[];
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DirectMessageWithMeta extends DirectMessage {
  author: Profile | null;
  reactions: ReactionGroup[];
  replyTo: { id: string; content: string; author: Profile | null } | null;
}
