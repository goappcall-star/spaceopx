import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MonitorPlay } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOptionalVoice } from "@/hooks/use-voice";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function WatchStreamButton({
  userId,
  sharedServers,
  onDone,
}: {
  userId: string;
  sharedServers: { id: string }[];
  onDone?: (() => void) | undefined;
}) {
  const voice = useOptionalVoice();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const roomId = Object.entries(voice?.participantsByChannel ?? {}).find(([, participants]) =>
    participants.some((participant) => participant.user_id === userId && participant.screen),
  )?.[0];
  const { data: room } = useQuery({
    queryKey: ["watch-stream-room", roomId, user?.id],
    enabled: !!roomId && !!user && user.id !== userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id,server_id,name")
        .eq("id", roomId!)
        .eq("type", "voice")
        .single();
      if (error || !data) return null;
      const permission = await supabase.rpc("has_channel_permission", {
        _channel_id: data.id,
        _user_id: user!.id,
        _perm: "connect",
      });
      return !permission.error && permission.data ? data : null;
    },
    staleTime: 0,
  });
  if (!voice || !roomId || !room || !sharedServers.some((server) => server.id === room.server_id))
    return null;
  async function watch() {
    if (!voice || !room || busy) return;
    setBusy(true);
    try {
      // Check permissions again at action time; cached profile data is only a UI hint.
      const permission = await supabase.rpc("has_channel_permission", {
        _channel_id: room.id,
        _user_id: user!.id,
        _perm: "connect",
      });
      if (permission.error || !permission.data)
        throw new Error("Você não tem permissão para assistir neste canal.");
      voice.setVideoHidden(userId, false);
      if (voice.activeChannelId !== room.id || voice.activeServerId !== room.server_id)
        await voice.join(room.id, room.server_id, true);
      await navigate({ to: "/app", search: { server: room.server_id, channel: room.id } });
      onDone?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível assistir à transmissão.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button
      className="mt-3 w-full"
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={() => void watch()}
      title={`Entrar em ${room.name} para assistir; o microfone começará mutado.`}
    >
      <MonitorPlay className="mr-2 h-4 w-4" />
      {busy ? "Conectando…" : "Assistir transmissão"}
    </Button>
  );
}
