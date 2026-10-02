import { useNavigate } from "@tanstack/react-router";
import { useVoice } from "@/hooks/use-voice";
import { useMyServers, useServerChannels } from "@/hooks/use-servers";
import { VoiceBar } from "./VoiceBar";
import { useSessionServer } from "@/components/call/SessionCommunications";

export function ConnectedVoiceBar({ floating = false }: { floating?: boolean }) {
  const { activeChannelId, activeServerId } = useVoice();
  const { data: servers = [] } = useMyServers(Boolean(activeServerId));
  const { data: channels = [] } = useServerChannels(activeServerId);
  const navigate = useNavigate();
  const { setVoiceReturn } = useSessionServer();
  if (!activeChannelId || !activeServerId) return null;
  const channel = channels.find((item) => item.id === activeChannelId);
  const server = servers.find((item) => item.id === activeServerId);
  return (
    <div
      className={
        floating
          ? "fixed bottom-4 left-4 z-50 w-64 overflow-hidden rounded-xl border border-border shadow-xl"
          : undefined
      }
    >
      <VoiceBar
        channelName={`${channel?.name ?? "Canal de voz"} / ${server?.name ?? "Servidor"}`}
        onReturn={() => {
          setVoiceReturn({ serverId: activeServerId, channelId: activeChannelId });
          void navigate({ to: "/app", search: {} });
        }}
      />
    </div>
  );
}
