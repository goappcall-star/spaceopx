import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Signal,
  Video,
  VideoOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { NoiseSuppressionToggle } from "@/components/voice/NoiseSuppressionToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import { supportsCamera, supportsScreenShare } from "@/services/voice";

const STATE_LABEL: Record<string, string> = {
  connecting: "Conectando...",
  connected: "Voz conectada",
  reconnecting: "Reconectando...",
  error: "Falha na conexão",
  disconnected: "Desconectado",
};

export function VoiceBar({
  channelName,
  onReturn,
}: {
  channelName: string;
  onReturn?: () => void;
}) {
  const {
    connectionState,
    muted,
    deafened,
    cameraOn,
    screenOn,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    leave,
  } = useVoice();
  const connected = connectionState === "connected";

  return (
    <div className="border-border bg-surface-elevated relative border-t px-3 py-2.5">
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px",
          connected
            ? "bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-success)_70%,transparent),transparent)]"
            : "bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--color-warning)_70%,transparent),transparent)]",
        )}
      />
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            connected ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
          )}
        >
          <Signal className={cn("h-3.5 w-3.5", !connected && "animate-pulse")} />
        </span>
        <button
          type="button"
          onClick={onReturn}
          title="Voltar à chamada"
          className="min-w-0 flex-1 text-left hover:opacity-80"
        >
          <p
            className={cn(
              "truncate text-xs font-semibold tracking-tight",
              connected ? "text-success" : "text-warning",
            )}
          >
            {STATE_LABEL[connectionState]}
          </p>
          <p className="text-muted-foreground truncate text-[11px]">🔊 {channelName}</p>
        </button>
        <NoiseSuppressionToggle compact />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:bg-destructive/15 hover:text-destructive h-8 w-8"
              aria-label="Desconectar da voz"
              onClick={() => void leave()}
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Desconectar</TooltipContent>
        </Tooltip>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <Button
          size="sm"
          variant={muted ? "destructive" : "secondary"}
          title={muted ? "Ativar microfone" : "Silenciar microfone"}
          onClick={toggleMute}
          aria-pressed={muted}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="sr-only">{muted ? "Ativar microfone" : "Silenciar microfone"}</span>
        </Button>
        <Button
          size="sm"
          variant={deafened ? "destructive" : "secondary"}
          title={deafened ? "Ativar áudio" : "Silenciar áudio"}
          onClick={toggleDeafen}
          aria-pressed={deafened}
        >
          {deafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          <span className="sr-only">{deafened ? "Ativar áudio" : "Silenciar áudio"}</span>
        </Button>

        {(supportsCamera() || supportsScreenShare()) && (
          <div className="contents">
            {supportsCamera() && (
              <Button
                size="sm"
                variant={cameraOn ? "default" : "secondary"}
                title={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                onClick={() => void toggleCamera()}
                aria-pressed={cameraOn}
              >
                {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                <span className="sr-only">Câmera</span>
              </Button>
            )}
            {supportsScreenShare() && (
              <Button
                size="sm"
                variant={screenOn ? "default" : "secondary"}
                title={screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
                onClick={() => void toggleScreenShare()}
                aria-pressed={screenOn}
              >
                {screenOn ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                <span className="sr-only">Compartilhar tela</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
