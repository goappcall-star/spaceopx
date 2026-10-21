export type EventResponse = "none" | "interested" | "going";
export type EventMode = "upcoming" | "past" | "cancelled";
export interface CommunityEventPayload {
  title: string;
  description: string;
  cover_url: string | null;
  channel_id: string;
  starts_at: string;
  ends_at: string | null;
  timezone: string;
}
export interface CommunityEvent extends Omit<CommunityEventPayload, "channel_id"> {
  id: string;
  server_id: string;
  channel_id: string | null;
  status: "scheduled" | "cancelled";
  revision: number;
  created_at: string;
  updated_at: string;
  interested_count: number;
  going_count: number;
  my_response: EventResponse;
  my_notify: boolean;
}
export interface CommunityEventPage {
  items: CommunityEvent[];
  has_more: boolean;
  can_manage: boolean;
}
export interface CommunityEventNotification {
  id: string;
  event_id: string;
  server_id: string;
  title: string;
  kind: "updated" | "cancelled" | "reminder";
  created_at: string;
  starts_at: string;
}
