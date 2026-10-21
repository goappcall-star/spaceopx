import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useVoice } from "@/hooks/use-voice";
import { useCall } from "@/hooks/use-call";
import { supabase } from "@/integrations/supabase/client";
import { authorizeSocialRooms, type SocialRoom } from "@/lib/social-activity";
import type { ConversationOverview } from "@/types";

/** Read existing occupancy only: never join a call, track presence, or touch media. */
export function useSocialActivity(
  userId: string | undefined,
  conversations: ConversationOverview[],
) {
  const voice = useVoice();
  const call = useCall();
  const client = useQueryClient();
  const roomKey = JSON.stringify([
    Object.entries(voice.participantsByChannel).map(([id, peers]) => [
      id,
      peers.map((p) => p.user_id).sort(),
    ]),
    call.groupConversationId,
    call.participants.map((p) => p.id).sort(),
    call.status,
  ]);
  const query = useQuery({
    queryKey: ["social-call-access", userId, roomKey],
    enabled: Boolean(userId),
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const ids = Object.keys(voice.participantsByChannel).filter(
        (id) => voice.participantsByChannel[id]?.length,
      );
      const rooms: SocialRoom[] = [];
      if (ids.length) {
        const { data, error } = await supabase
          .from("channels")
          .select("id,name,server_id,type")
          .in("id", ids);
        if (error) throw error;
        for (const channel of data ?? []) {
          if (channel.type !== "voice") continue;
          rooms.push({
            id: channel.id,
            kind: "server",
            name: channel.name,
            context: channel.server_id,
            userIds: voice.participantsByChannel[channel.id]?.map((p) => p.user_id) ?? [],
          });
        }
      }
      const group = conversations.find(
        (c) => c.id === call.groupConversationId && c.type === "group",
      );
      if (group && ["active", "waiting", "reconnecting"].includes(call.status)) {
        rooms.push({
          id: group.id,
          kind: "group",
          name: group.name ?? "Grupo",
          context: "Grupo em comum",
          userIds: call.participants.map((p) => p.id),
        });
      }
      return authorizeSocialRooms(userId, rooms, async (room, viewerId) => {
        if (room.kind === "group") {
          const { data: allowed, error } = await supabase.rpc("is_conversation_member", {
            _conversation_id: room.id,
            _user_id: viewerId,
          });
          if (error || allowed !== true) throw new Error("Membership unavailable");
          const { data: members, error: membersError } = await supabase
            .from("conversation_members")
            .select("user_id")
            .eq("conversation_id", room.id);
          if (membersError) throw membersError;
          return {
            viewerMember: (members ?? []).some((m) => m.user_id === viewerId),
            canView: true,
            canConnect: true,
            members: (members ?? []).map((m) => m.user_id),
          };
        }
        const [member, banned, view, connect] = await Promise.all([
          supabase.rpc("is_server_member", { _server_id: room.context, _user_id: viewerId }),
          supabase.rpc("is_server_banned", { _server_id: room.context, _user_id: viewerId }),
          supabase.rpc("has_channel_permission", {
            _channel_id: room.id,
            _user_id: viewerId,
            _perm: "view_channel",
          }),
          supabase.rpc("has_channel_permission", {
            _channel_id: room.id,
            _user_id: viewerId,
            _perm: "connect",
          }),
        ]);
        if ([member, banned, view, connect].some((r) => r.error))
          throw new Error("Access unavailable");
        if (
          member.data !== true ||
          banned.data !== false ||
          view.data !== true ||
          connect.data !== true
        ) {
          return { viewerMember: false, canView: false, canConnect: false, members: [] };
        }
        const { data: members, error } = await supabase
          .from("server_members")
          .select("user_id")
          .eq("server_id", room.context)
          .in("user_id", room.userIds);
        if (error) throw error;
        return {
          viewerMember: true,
          canView: true,
          canConnect: true,
          members: (members ?? []).map((m) => m.user_id),
        };
      });
    },
  });
  useEffect(() => {
    // Existing RLS-protected permission invalidations already refresh these keys.
    // Share that signal instead of opening a competing presence subscription.
    return client.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        event.action.type === "invalidate" &&
        ["channels", "members", "roles", "servers", "conversations"].includes(
          String(event.query.queryKey[0]),
        )
      ) {
        void client.invalidateQueries({ queryKey: ["social-call-access", userId] });
      }
    });
  }, [userId, client]);
  // Background, errors, disconnects and in-flight permission checks fail closed.
  return useMemo(
    () =>
      query.isFetching || query.isPaused || query.isError || (query.isStale && !query.data)
        ? []
        : (query.data ?? []),
    [query.isFetching, query.isPaused, query.isError, query.isStale, query.data],
  );
}
