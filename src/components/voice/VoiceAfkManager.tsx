import { useRef } from "react";
import { toast } from "sonner";
import { useVoice } from "@/hooks/use-voice";
import { useServerChannels } from "@/hooks/use-servers";
import { useVoiceAfk } from "@/hooks/use-voice-afk";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function VoiceAfkManager() {
  const voice = useVoice();
  const { user } = useAuth();
  const { data: channels = [] } = useServerChannels(voice.activeServerId);
  const afkId = channels.find((channel) => channel.type === "voice" && channel.is_afk)?.id ?? null;
  const latest = useRef({ voice, user, afkId });
  latest.current = { voice, user, afkId };
  const move = useRef(async (id: string) => {
    const current = latest.current;
    if (!current.user || !current.voice.muted || !current.voice.activeChannelId) return;
    const room = current.voice.activeChannelId;
    const server = current.voice.activeServerId;
    const { data, error } = await supabase.rpc("has_channel_permission", {
      _channel_id: id,
      _user_id: current.user.id,
      _perm: "connect",
    });
    if (
      error ||
      !data ||
      latest.current.voice.activeChannelId !== room ||
      latest.current.voice.activeServerId !== server ||
      !latest.current.voice.muted ||
      latest.current.afkId !== id
    )
      return;
    // join() follows the browsed server by default. Temporarily browsing another
    // server must never move this call there; the internal context supplies the source.
    await current.voice.join(id, server!);
    if (latest.current.voice.activeChannelId === id)
      toast.info("Você foi movido para o canal AFK após 10 minutos com o microfone mutado.");
  });
  useVoiceAfk({ muted: voice.muted, roomId: voice.activeChannelId, afkId, join: move.current });
  return null;
}
