import { supabase } from "@/integrations/supabase/client";
import {
  parseModerationAccess,
  parseReport,
  parseWarning,
  parseHistory,
  parseModerationPage,
  parseCommunitySecurity,
  parsePlatformDirectory,
  validateSecurity,
} from "@/lib/community-moderation";
import type {
  ModerationCursor,
  ModerationCapability,
  ReportCategory,
  ReportKind,
  SecuritySettings,
} from "@/types/community-moderation";
import type { Json } from "@/integrations/supabase/types";
const cursorArgs = (c?: ModerationCursor) =>
  c ? { _before_time: c.created_at, _before_id: c.id } : {};
export const moderationService = {
  async access(serverId?: string) {
    const { data, error } = await supabase.rpc(
      "community_moderation_access",
      serverId ? { _server_id: serverId } : {},
    );
    if (error) throw error;
    return parseModerationAccess(data);
  },
  async submit(
    id: string,
    serverId: string,
    kind: ReportKind,
    targetId: string,
    category: ReportCategory,
    description: string,
  ) {
    const { data, error } = await supabase.rpc("submit_community_report", {
      _id: id,
      _server_id: serverId,
      _kind: kind,
      _target_id: targetId,
      _category: category,
      _description: description,
    });
    if (error) throw error;
    return data;
  },
  async reports(
    serverId: string | undefined,
    status: string,
    search: string,
    cursor?: ModerationCursor,
    mine = false,
  ) {
    const { data, error } = await supabase.rpc("list_community_reports", {
      ...(serverId ? { _server_id: serverId } : {}),
      _status: status,
      _search: search,
      ...cursorArgs(cursor),
      _limit: 20,
      _mine: mine,
    });
    if (error) throw error;
    return parseModerationPage(data, parseReport);
  },
  async review(id: string, revision: number, status: "resolved" | "dismissed", reason: string) {
    const { error } = await supabase.rpc("review_community_report", {
      _id: id,
      _expected_revision: revision,
      _status: status,
      _reason: reason,
    });
    if (error) throw error;
  },
  async history(
    serverId: string | undefined,
    mode: "warnings" | "history" | "mine",
    cursor?: ModerationCursor,
  ) {
    const { data, error } = await supabase.rpc("list_community_moderation_history", {
      ...(serverId ? { _server_id: serverId } : {}),
      _mode: mode,
      ...cursorArgs(cursor),
      _limit: 20,
    });
    if (error) throw error;
    return mode === "history"
      ? parseModerationPage(data, parseHistory)
      : parseModerationPage(data, parseWarning);
  },
  async warnings(serverId: string, cursor?: ModerationCursor, mine = false) {
    const { data, error } = await supabase.rpc("list_community_moderation_history", {
      _server_id: serverId,
      _mode: mine ? "mine" : "warnings",
      ...cursorArgs(cursor),
      _limit: 20,
    });
    if (error) throw error;
    return parseModerationPage(data, parseWarning);
  },
  async act(
    id: string,
    serverId: string,
    target: string,
    action: "warn" | "kick" | "ban",
    reason: string,
  ) {
    const { error } = await supabase.rpc("moderate_community_member", {
      _action_id: id,
      _server_id: serverId,
      _target: target,
      _action: action,
      _reason: reason,
    });
    if (error) throw error;
  },
  async revokeWarning(id: string, revision: number, reason: string) {
    const { error } = await supabase.rpc("review_community_warning", {
      _id: id,
      _expected_revision: revision,
      _reason: reason,
    });
    if (error) throw error;
  },
  async security(serverId: string) {
    const { data, error } = await supabase.rpc("get_community_security", { _server_id: serverId });
    if (error) throw error;
    return parseCommunitySecurity(data);
  },
  async saveSecurity(serverId: string, value: SecuritySettings) {
    const { revision, ...p } = validateSecurity(value);
    const { error } = await supabase.rpc("save_community_security", {
      _server_id: serverId,
      _payload: p as unknown as Json,
      _expected_revision: revision,
    });
    if (error) throw error;
  },
  async grant(serverId: string, roleId: string, capabilities: ModerationCapability[]) {
    const { error } = await supabase.rpc("set_community_moderator_role", {
      _server_id: serverId,
      _role_id: roleId,
      _capabilities: capabilities,
    });
    if (error) throw error;
  },
  async directory(serverId: string) {
    const { data, error } = await supabase.rpc("get_platform_directory_review", {
      _server_id: serverId,
    });
    if (error) throw error;
    const d = parsePlatformDirectory(data);
    if (d && d.server_id !== serverId) throw Error("moderation_invalid_response");
    return d;
  },
  async curate(
    serverId: string,
    revision: number,
    action: "suspend" | "restore" | "remove_feature",
    reason: string,
  ) {
    const { error } = await supabase.rpc("moderate_platform_directory", {
      _server_id: serverId,
      _expected_revision: revision,
      _action: action,
      _reason: reason,
    });
    if (error) throw error;
  },
};
