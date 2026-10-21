export interface DiscoveryPayload {
  name: string;
  description: string;
  icon_url: string | null;
  banner_url: string | null;
  category: string;
  language: string;
  interests: string[];
  public_rules: string[];
  admission: "direct" | "approval";
  consent: boolean;
}
export interface PublicCommunity extends Omit<DiscoveryPayload, "consent"> {
  server_id: string;
  published_at: string | null;
  featured: boolean;
}
export interface CommunityPresentation extends PublicCommunity {
  revision: number;
  my_membership: boolean;
  can_join: boolean;
  my_request: {
    status: "pending" | "approved" | "rejected" | "withdrawn";
    revision: number;
  } | null;
}
export interface DiscoverySettings {
  is_owner: boolean;
  listing:
    (PublicCommunity & { status: "listed" | "unlisted" | "suspended"; revision: number }) | null;
}
export interface DiscoveryFilters {
  search: string;
  category: string;
  language: string;
  interest: string;
  featured: boolean;
}
export interface DiscoveryCursor {
  published_at: string;
  server_id: string;
}
export interface JoinRequest {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  revision: number;
  created_at: string;
}
export interface DiscoveryPage {
  items: PublicCommunity[];
  has_more: boolean;
}
