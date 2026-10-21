import { supabase } from "@/integrations/supabase/client";
import {
  validateEventPayload,
  parseCommunityEvent,
  parseEventPage,
  parseEventNotifications,
} from "@/lib/community-events";
import type {
  CommunityEvent,
  CommunityEventPayload,
  EventMode,
  EventResponse,
} from "@/types/community-events";
import type { Json } from "@/integrations/supabase/types";
export const communityEventsService = {
  async list(serverId: string, mode: EventMode, cursor?: { starts_at: string; id: string }) {
    const { data, error } = await supabase.rpc("list_community_events", {
      _server_id: serverId,
      _mode: mode,
      _limit: 12,
      ...(cursor ? { _after_start: cursor.starts_at, _after_id: cursor.id } : {}),
    });
    if (error) throw error;
    return parseEventPage(data, serverId);
  },
  async save(serverId: string, id: string, payload: CommunityEventPayload, revision: number) {
    const { data, error } = await supabase.rpc("save_community_event", {
      _server_id: serverId,
      _event_id: id,
      _payload: validateEventPayload(payload) as unknown as Json,
      _expected_revision: revision,
    });
    if (error) throw error;
    return parseCommunityEvent(data, serverId);
  },
  async cancel(event: CommunityEvent) {
    const { error } = await supabase.rpc("cancel_community_event", {
      _event_id: event.id,
      _expected_revision: event.revision,
    });
    if (error) throw error;
  },
  async respond(event: CommunityEvent, response: EventResponse, notify: boolean) {
    const { error } = await supabase.rpc("respond_community_event", {
      _event_id: event.id,
      _expected_revision: event.revision,
      _response: response,
      _notify: notify,
    });
    if (error) throw error;
  },
  async notifications() {
    const { data, error } = await supabase.rpc("list_my_community_event_notifications");
    if (error) throw error;
    return parseEventNotifications(data);
  },
  async read(ids: string[]) {
    const { error } = await supabase.rpc("read_community_event_notifications", { _ids: ids });
    if (error) throw error;
  },
};
