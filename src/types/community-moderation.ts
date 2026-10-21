export type ModerationCapability = "reports" | "warnings" | "members" | "security" | "history";
export type ReportKind = "message" | "member" | "event" | "notice" | "directory";
export type ReportCategory = "spam" | "harassment" | "unsafe" | "privacy" | "other";
export interface ModerationAccess {
  platform: boolean;
  owner: boolean;
  capabilities: ModerationCapability[];
}
export interface ModerationCursor {
  created_at: string;
  id: string;
}
export interface ModerationDecision {
  action: string;
  reason: string | null;
  actor_id: string | null;
  created_at: string;
}
export interface CommunityReport {
  id: string;
  server_id: string;
  kind: ReportKind;
  target_id: string;
  category: ReportCategory;
  status: "pending" | "resolved" | "dismissed";
  revision: number;
  description: string | null;
  evidence: string | null;
  evidence_until: string;
  reviewed_by: string | null;
  created_at: string;
  decisions: ModerationDecision[];
}
export interface CommunityWarning {
  id: string;
  target_user_id: string | null;
  actor_id: string | null;
  reason: string | null;
  status: "active" | "revoked";
  revision: number;
  created_at: string;
  decisions: ModerationDecision[];
}
export interface ModerationHistory extends ModerationDecision {
  id: string;
  entity_id: string;
}
export interface ModerationPage<T> {
  items: T[];
  has_more: boolean;
}
export interface SecuritySettings {
  revision: number;
  enabled: boolean;
  burst_limit: number;
  repeat_limit: number;
  mentions_limit: number;
  blocked_domains: string[];
}
export interface ModeratorGrant {
  role_id: string;
  name: string;
  capabilities: ModerationCapability[];
}
export interface CommunitySecurity {
  settings: SecuritySettings;
  grants: ModeratorGrant[];
}
export interface PlatformDirectoryReview {
  server_id: string;
  revision: number;
  status: "unlisted" | "listed" | "suspended";
  featured: boolean;
  presentation: { name: string; description: string } | null;
}
