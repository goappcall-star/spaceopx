import { openScreenSharePanel } from "@/services/screen-share-panel";
import { VoiceIcon } from "./VoiceIcon";
import { AudioInputControl, AudioOutputControl } from "./AudioOutputControl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeviceSettingsDialog } from "@/components/voice/DeviceSettingsDialog";
import { NoiseSuppressionToggle } from "@/components/voice/NoiseSuppressionToggle";
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
      <div className="border-border bg-surface-elevated/80 mx-auto flex max-w-full flex-wrap justify-center items-center gap-1 sm:gap-2 rounded-2xl border px-3 py-2 backdrop-blur">
        <AudioInputControl
          boxed
          label={
            pttMode
              ? `Push to talk — segure ${keyLabel(settings.pttKey)}`
              : muted
                ? "Ativar microfone"
                : "Desativar microfone"
          }
          muted={muted}
          off={muted || (pttMode && !pttActive)}
          active={!muted && pttMode && pttActive}
          onToggle={toggleMute}
        />
        <AudioOutputControl boxed deafened={deafened} onToggle={toggleDeafen} />

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
            <VoiceIcon kind="camera" className="h-5 w-5" />
          </ControlButton>
        )}

        {screenAvailable && (
          <ControlButton
            label={screenOn ? "Configurar transmissão" : "Compartilhar tela"}
            active={screenOn}
            onClick={() => openScreenSharePanel("voice")}
          >
            <VoiceIcon kind="screen" className="h-5 w-5" />
          </ControlButton>
        )}

        <ControlButton label="Voz e áudio" onClick={() => setDevicesOpen(true)}>
          <VoiceIcon kind="settings" className="h-5 w-5" />
        </ControlButton>

        <span className="bg-border mx-1 h-7 w-px" aria-hidden />

        <NoiseSuppressionToggle />
        <ControlButton label="Sair da chamada" danger onClick={() => void leave()}>
          <VoiceIcon kind="disconnect" className="h-5 w-5" />
        </ControlButton>
      </div>

      <DeviceSettingsDialog open={devicesOpen} onOpenChange={setDevicesOpen} />
    </>
  );
}
