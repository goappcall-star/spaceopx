import { supabase } from "@/integrations/supabase/client";
export interface VoiceMoveRequest {
  id: string;
  recipient_id: string;
  server_id: string;
  source_channel_id: string;
  destination_channel_id: string;
  voice_session_id: string;
  created_at: string;
}
export async function requestVoiceMove(
  userId: string,
  source: string,
  destination: string,
  session: string,
) {
  const { error } = await supabase.rpc("request_voice_move", {
    _user_id: userId,
    _source: source,
    _destination: destination,
    _session: session,
  });
  if (error) throw error;
}
export function shouldApplyVoiceMove(
  request: VoiceMoveRequest,
  userId: string | undefined,
  serverId: string | null,
  channelId: string | null,
  session: string,
  now = Date.now(),
) {
  const age = now - Date.parse(request.created_at);
  return (
    request.recipient_id === userId &&
    request.server_id === serverId &&
    request.source_channel_id === channelId &&
    request.voice_session_id === session &&
    age >= -5000 &&
    age < 15000
  );
}
