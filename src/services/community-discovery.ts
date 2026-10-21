import { supabase } from "@/integrations/supabase/client";
import {
  parseDiscoveryPage,
  parsePresentation,
  parseDiscoverySettings,
  parseJoinRequests,
  validateDiscoveryPayload,
} from "@/lib/community-discovery";
import type {
  DiscoveryFilters,
  DiscoveryCursor,
  DiscoveryPayload,
} from "@/types/community-discovery";
import type { Json } from "@/integrations/supabase/types";
export const discoveryService = {
  async search(f: DiscoveryFilters, cursor?: DiscoveryCursor) {
    const { data, error } = await supabase.rpc("search_community_directory", {
      _search: f.search,
      _category: f.category,
      _language: f.language,
      _interest: f.interest,
      _featured: f.featured,
      ...(cursor ? { _before_time: cursor.published_at, _before_id: cursor.server_id } : {}),

      _limit: 12,
    });
    if (error) throw error;
    return parseDiscoveryPage(data);
  },
  async presentation(id: string) {
    const { data, error } = await supabase.rpc("get_public_community", { _server_id: id });
    if (error) throw error;
    const p = parsePresentation(data);
    if (p && p.server_id !== id) throw Error("directory_invalid_response");
    return p;
  },
  async settings(id: string) {
    const { data, error } = await supabase.rpc("get_community_discovery_settings", {
      _server_id: id,
    });
    if (error) throw error;
    const s = parseDiscoverySettings(data);
    if (s.listing && s.listing.server_id !== id) throw Error("directory_invalid_response");
    return s;
  },
  async save(id: string, payload: DiscoveryPayload, revision: number, publish: boolean) {
    const { data, error } = await supabase.rpc("save_community_discovery", {
      _server_id: id,
      _payload: validateDiscoveryPayload(payload) as unknown as Json,
      _expected_revision: revision,
      _publish: publish,
    });
    if (error) throw error;
    const saved = parseDiscoverySettings(data);
    if (saved.listing && saved.listing.server_id !== id) throw Error("directory_invalid_response");
    return saved;
  },
  async join(id: string, revision: number, withdraw = false) {
    const { data, error } = await supabase.rpc("join_discovered_community", {
      _server_id: id,
      _expected_revision: revision,
      _withdraw: withdraw,
    });
    if (error) throw error;
    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data["server_id"] !== id ||
      !["member", "pending", "withdrawn"].includes(String(data["status"]))
    )
      throw Error("directory_invalid_response");
    return String(data["status"]);
  },
  async requests(id: string, cursor?: { created_at: string; user_id: string }) {
    const { data, error } = await supabase.rpc("list_community_join_requests", {
      _server_id: id,
      ...(cursor ? { _after_time: cursor.created_at, _after_id: cursor.user_id } : {}),

      _limit: 20,
    });
    if (error) throw error;
    return parseJoinRequests(data);
  },
  async review(id: string, userId: string, revision: number, approve: boolean) {
    const { error } = await supabase.rpc("review_community_join_request", {
      _server_id: id,
      _user_id: userId,
      _expected_revision: revision,
      _approve: approve,
    });
    if (error) throw error;
  },
};
