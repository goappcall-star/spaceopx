import {
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VideoTile, type TileData } from "@/components/voice/VideoTile";
import { useAuth } from "@/hooks/use-auth";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useCall } from "@/hooks/use-call";
import { cn } from "@/lib/utils";

function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Plays the peer's microphone audio. */
function CallAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const { settings } = useAudioSettings();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);
  useEffect(() => {
    const el = ref.current as
      | (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> })
      | null;
    if (!el) return;
    el.volume = Math.min(1, settings.outputVolume / 100);
    if (settings.outputDeviceId && typeof el.setSinkId === "function")
      void el.setSinkId(settings.outputDeviceId).catch(() => undefined);
  }, [settings.outputVolume, settings.outputDeviceId, stream]);
  return <audio ref={ref} autoPlay className="hidden" />;
}

export function CallOverlay() {
  const { profile } = useAuth();
  const call = useCall();
  const {
    status,
    endReason,
    peer,
    muted,
    cameraOn,
    screenOn,
    localCamera,
    localScreen,
    remote,
  } = call;

  const visible = status !== "idle";
  const connected = status === "active" || status === "reconnecting";
  const elapsed = useElapsed(connected);

  const tiles = useMemo<TileData[]>(() => {
    if (!peer || !profile) return [];
    const list: TileData[] = [
      {
        userId: peer.id,
        name: peer.display_name,
        avatarUrl: peer.avatar_url,
        stream: remote?.camera ?? null,
        kind: "camera",
        isSelf: false,
        speaking: false,
        muted: false,
        screenSharing: !!remote?.screen,
      },
      {
        userId: profile.id,
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
        stream: localCamera,
        kind: "camera",
        isSelf: true,
        speaking: false,
        muted,
        screenSharing: screenOn,
      },
    ];
    return list;
  }, [peer, profile, remote, localCamera, muted, screenOn]);

  const screenTile = useMemo<TileData | null>(() => {
    if (remote?.screen && peer)
      return {
        userId: peer.id,
        name: peer.display_name,
        avatarUrl: peer.avatar_url,
        stream: remote.screen,
        kind: "screen",
        isSelf: false,
        speaking: false,
        muted: false,
        screenSharing: true,
      };
    if (localScreen && profile)
      return {
        userId: profile.id,
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
        stream: localScreen,
        kind: "screen",
        isSelf: true,
        speaking: false,
        muted,
        screenSharing: true,
      };
    return null;
  }, [remote, localScreen, peer, profile, muted]);

  useEffect(() => {
    if (status !== "ended") return;
    const id = setTimeout(call.dismiss, 2500);
    return () => clearTimeout(id);
  }, [status, call]);

  if (!visible || !peer) return null;

  const label =
    status === "outgoing"
      ? "Chamando..."
      : status === "connecting"
        ? "Conectando..."
        : status === "reconnecting"
          ? "Reconectando..."
          : status === "ended"
            ? endReason === "declined"
              ? "Chamada recusada"
              : endReason === "busy"
                ? "Usuário ocupado"
                : endReason === "unanswered"
                  ? "Sem resposta"
                  : endReason === "failed"
                    ? "Falha na chamada"
                    : "Chamada encerrada"
            : elapsed;

  return (
    <div className="bg-background/90 fixed inset-0 z-[70] flex flex-col backdrop-blur-2xl">
      <CallAudio stream={remote?.audio ?? null} />

      <header className="flex h-16 shrink-0 items-center gap-3 px-6">
        <Avatar className="ring-border h-9 w-9 ring-1">
          <AvatarImage src={peer.avatar_url ?? undefined} alt="" />
          <AvatarFallback className="bg-surface-elevated text-xs">
            {peer.display_name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{peer.display_name}</p>
          <p
            className={cn(
              "text-xs",
              connected ? "text-primary font-mono" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-6 pb-4">
        {screenTile ? (
          <div className="flex h-full flex-col gap-3 lg:flex-row">
            <VideoTile tile={screenTile} className="min-h-0 flex-1" large />
            <div className="flex gap-3 lg:w-56 lg:flex-col">
              {tiles.map((tile) => (
                <VideoTile
                  key={`${tile.userId}-${tile.kind}`}
                  tile={tile}
                  className="aspect-video flex-1"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto grid h-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            {tiles.map((tile) => (
              <VideoTile key={`${tile.userId}-${tile.kind}`} tile={tile} large />
            ))}
          </div>
        )}
      </div>

      <footer className="flex h-24 shrink-0 items-center justify-center gap-3">
        {status === "ended" ? (
          <Button variant="outline" onClick={call.dismiss}>
            Fechar
          </Button>
        ) : (
          <>
            <CallButton
              label={muted ? "Ativar microfone" : "Silenciar microfone"}
              active={muted}
              danger={muted}
              disabled={!connected}
              onClick={call.toggleMute}
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </CallButton>

            <CallButton
              label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
              active={cameraOn}
              disabled={!connected}
              onClick={() => void call.toggleCamera()}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </CallButton>

            <CallButton
              label={screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
              active={screenOn}
              disabled={!connected}
              onClick={() => void call.toggleScreenShare()}
            >
              <MonitorUp className="h-5 w-5" />
            </CallButton>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="destructive"
                  className="h-12 w-16 rounded-full"
                  onClick={call.hangUp}
                  aria-label="Encerrar chamada"
                >
                  {status === "outgoing" ? (
                    <Phone className="h-5 w-5 rotate-[135deg]" />
                  ) : (
                    <PhoneOff className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Encerrar</TooltipContent>
            </Tooltip>
          </>
        )}
      </footer>
    </div>
  );
}

function CallButton({
  label,
  active,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className={cn(
            "border-border bg-surface h-12 w-12 rounded-full border",
            active && !danger && "border-primary/60 text-primary glow-soft",
            danger && "border-destructive/60 text-destructive",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
