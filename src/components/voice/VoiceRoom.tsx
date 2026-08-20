import { useMemo } from "react";
import { AlertTriangle, Loader2, MonitorUp, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RemoteAudio } from "@/components/voice/RemoteAudio";
import { VideoTile, type TileData } from "@/components/voice/VideoTile";
import { VoiceControlBar } from "@/components/voice/VoiceControlBar";
import { useGamePresenceMap } from "@/hooks/use-gamer";
import { useVoice } from "@/hooks/use-voice";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Channel, MemberWithProfile } from "@/types";

interface Props {
  channel: Channel;
  members: MemberWithProfile[];
  me: MemberWithProfile | undefined;
  userId: string | undefined;
}

const STATE_COPY: Record<string, string> = {
  connecting: "Conectando...",
  connected: "Conectado",
  reconnecting: "Reconectando...",
  error: "Falha na conexão",
  disconnected: "Desconectado",
};

function gridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-4";
}

export function VoiceRoom({ channel, members, me, userId }: Props) {
  const {
    participantsByChannel,
    activeChannelId,
    connectionState,
    join,
    volumes,
    setUserVolume,
    remoteMedia,
    localCamera,
    localScreen,
  } = useVoice();

  const participants = participantsByChannel[channel.id] ?? [];
  const inThisRoom = activeChannelId === channel.id;
  const canConnect = hasPermission(me, "connect");
  const presenceMap = useGamePresenceMap(participants.map((p) => p.user_id));

  const { cameraTiles, screenTiles } = useMemo(() => {
    const cameras: TileData[] = [];
    const screens: TileData[] = [];
    for (const participant of participants) {
      const member = members.find((m) => m.user_id === participant.user_id);
      const name = member?.nickname ?? member?.profile?.display_name ?? "Usuário";
      const isSelf = participant.user_id === userId;
      const media = remoteMedia[participant.user_id];
      const cameraStream = isSelf ? localCamera : (media?.camera ?? null);
      const screenStream = isSelf ? localScreen : (media?.screen ?? null);
      const presence = presenceMap[participant.user_id];
      const gameLabel =
        presence && presence.status === "playing" ? (presence.game?.name ?? null) : null;

      const base = {
        userId: participant.user_id,
        name,
        avatarUrl: member?.profile?.avatar_url ?? null,
        isSelf,
        speaking: participant.speaking,
        muted: participant.muted,
        screenSharing: !!screenStream || !!participant.screen,
        gameLabel,
      };

      cameras.push({ ...base, stream: cameraStream, kind: "camera" });
      if (screenStream) screens.push({ ...base, stream: screenStream, kind: "screen" });
    }
    return { cameraTiles: cameras, screenTiles: screens };
  }, [participants, members, userId, remoteMedia, localCamera, localScreen, presenceMap]);

  const sharing = screenTiles[0];

  if (!inThisRoom) {
    return (
      <div className="bg-hero-glow flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto p-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">🔊 {channel.name}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {participants.length === 0
              ? "Ninguém conectado ainda."
              : `${participants.length} conectado(s)`}
          </p>
        </div>

        {participants.length > 0 && (
          <ul className="flex max-w-3xl flex-wrap justify-center gap-3">
            {cameraTiles.map((tile) => (
              <li key={tile.userId} className="h-28 w-40">
                <VideoTile tile={{ ...tile, stream: null }} className="h-full w-full" />
              </li>
            ))}
          </ul>
        )}

        <Button
          disabled={!canConnect || connectionState === "connecting"}
          onClick={() => void join(channel.id)}
        >
          {connectionState === "connecting" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {canConnect ? "Entrar no canal de voz" : "Sem permissão para conectar"}
        </Button>
        <p className="text-muted-foreground max-w-md text-center text-xs">
          Câmera e microfone só são ativados após sua ação explícita.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-hero-glow flex flex-1 flex-col overflow-hidden">
      <RemoteAudio />

      <header className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">🔊 {channel.name}</h2>
          <p
            className={cn(
              "flex items-center gap-1.5 text-[11px]",
              connectionState === "connected"
                ? "text-success"
                : connectionState === "error"
                  ? "text-destructive"
                  : "text-warning",
            )}
          >
            {connectionState === "error" ? (
              <AlertTriangle className="h-3 w-3" />
            ) : connectionState !== "connected" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : null}
            {STATE_COPY[connectionState]} · {participants.length} participante(s)
          </p>
        </div>
        {sharing && (
          <p className="text-primary flex items-center gap-1.5 text-xs">
            <MonitorUp className="h-3.5 w-3.5" />
            {sharing.isSelf ? "Você está compartilhando a tela" : `${sharing.name} está compartilhando a tela`}
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {connectionState === "error" && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive mb-4 flex items-center gap-2 rounded-xl border p-3 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Não foi possível estabelecer a conexão de mídia. Verifique as permissões e tente
            reconectar.
          </div>
        )}

        {screenTiles.length > 0 ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="min-h-0 flex-1">
              {screenTiles.map((tile) => (
                <VideoTile key={`${tile.userId}-screen`} tile={tile} className="h-full min-h-[280px]" large />
              ))}
            </div>
            <ul className="flex gap-3 overflow-x-auto pb-1">
              {cameraTiles.map((tile) => (
                <li key={tile.userId} className="h-24 w-36 shrink-0">
                  <VideoTile
                    tile={tile}
                    className="h-full w-full"
                    volume={volumes[tile.userId] ?? 100}
                    onVolumeChange={(value) => setUserVolume(tile.userId, value)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className={cn("mx-auto grid max-w-5xl gap-3", gridClass(cameraTiles.length))}>
            {cameraTiles.map((tile) => (
              <li key={tile.userId} className="aspect-video">
                <VideoTile
                  tile={tile}
                  className="h-full w-full"
                  volume={volumes[tile.userId] ?? 100}
                  onVolumeChange={(value) => setUserVolume(tile.userId, value)}
                  large={cameraTiles.length === 1}
                />
              </li>
            ))}
            {cameraTiles.length === 0 && (
              <li className="text-muted-foreground flex flex-col items-center gap-2 py-16 text-sm">
                <Video className="h-5 w-5" />
                Ninguém conectado neste canal.
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="px-4 pb-4">
        <VoiceControlBar />
      </div>
    </div>
  );
}
