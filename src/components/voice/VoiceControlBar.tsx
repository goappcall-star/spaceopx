import {
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Settings,
  Video,
  VideoOff,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeviceSettingsDialog } from "@/components/voice/DeviceSettingsDialog";
import { useAudioSettings, keyLabel } from "@/hooks/use-audio-settings";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";
import { supportsCamera, supportsScreenShare } from "@/services/voice";

function ControlButton({
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
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          aria-label={label}
          aria-pressed={!!active}
          onClick={onClick}
          className={cn(
            "h-11 w-11 rounded-xl border transition-all",
            danger
              ? "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25"
              : active
                ? "border-primary/50 bg-primary/15 text-primary glow-soft hover:bg-primary/25"
                : "border-border bg-surface-elevated text-surface-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export function VoiceControlBar() {
  const {
    muted,
    deafened,
    cameraOn,
    screenOn,
    cameraPermission,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    pttActive,
    leave,
  } = useVoice();
  const { settings } = useAudioSettings();
  const pttMode = settings.inputMode === "ptt";
  const [devicesOpen, setDevicesOpen] = useState(false);

  const cameraAvailable = supportsCamera() && cameraPermission !== "unavailable";
  const screenAvailable = supportsScreenShare();

  return (
    <>
      <div className="border-border bg-surface-elevated/80 mx-auto flex items-center gap-2 rounded-2xl border px-3 py-2 backdrop-blur">
        <ControlButton
          label={
            pttMode
              ? `Push to talk — segure ${keyLabel(settings.pttKey)}`
              : muted
                ? "Ativar microfone"
                : "Desativar microfone"
          }
          danger={muted}
          active={!muted && pttMode && pttActive}
          onClick={toggleMute}
        >
          {muted || (pttMode && !pttActive) ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </ControlButton>

        {cameraAvailable && (
          <ControlButton
            label={
              cameraPermission === "denied"
                ? "Permissão de câmera negada"
                : cameraOn
                  ? "Desligar câmera"
                  : "Ligar câmera"
            }
            active={cameraOn}
            onClick={() => void toggleCamera()}
          >
            {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </ControlButton>
        )}

        {screenAvailable && (
          <ControlButton
            label={screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
            active={screenOn}
            onClick={() => void toggleScreenShare()}
          >
            {screenOn ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </ControlButton>
        )}

        <ControlButton
          label={deafened ? "Reativar áudio" : "Silenciar áudio"}
          danger={deafened}
          onClick={toggleDeafen}
        >
          {deafened ? <HeadphoneOff className="h-5 w-5" /> : <Headphones className="h-5 w-5" />}
        </ControlButton>

        <ControlButton label="Voz e áudio" onClick={() => setDevicesOpen(true)}>
          <Settings className="h-5 w-5" />
        </ControlButton>

        <span className="bg-border mx-1 h-7 w-px" aria-hidden />

        <ControlButton label="Sair da chamada" danger onClick={() => void leave()}>
          <PhoneOff className="h-5 w-5" />
        </ControlButton>
      </div>

      <DeviceSettingsDialog open={devicesOpen} onOpenChange={setDevicesOpen} />
    </>
  );
}
