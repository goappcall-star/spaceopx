import { useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoSurface } from "@/components/voice/VideoSurface";
import { useVoice } from "@/hooks/use-voice";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeviceSettingsDialog({ open, onOpenChange }: Props) {
  const { devices, selectedDevices, selectDevice, refreshDevices, localCamera, micPermission } =
    useVoice();

  useEffect(() => {
    if (open) void refreshDevices();
  }, [open, refreshDevices]);

  const supportsOutput =
    typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurações de áudio e vídeo</DialogTitle>
          <DialogDescription>
            Escolha os dispositivos usados nas chamadas deste navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Microfone</Label>
            <Select
              value={selectedDevices.microphoneId ?? ""}
              onValueChange={(value) => void selectDevice("microphoneId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Padrão do sistema" />
              </SelectTrigger>
              <SelectContent>
                {devices.microphones.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-[11px]">
              {micPermission === "denied"
                ? "Permissão de microfone negada pelo navegador."
                : devices.microphones.length === 0
                  ? "Conecte-se a um canal de voz para liberar a lista de dispositivos."
                  : "Ativo enquanto você estiver conectado."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Câmera</Label>
            <Select
              value={selectedDevices.cameraId ?? ""}
              onValueChange={(value) => void selectDevice("cameraId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Padrão do sistema" />
              </SelectTrigger>
              <SelectContent>
                {devices.cameras.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {supportsOutput && (
            <div className="space-y-1.5">
              <Label>Saída de áudio</Label>
              <Select
                value={selectedDevices.outputId ?? ""}
                onValueChange={(value) => void selectDevice("outputId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Padrão do sistema" />
                </SelectTrigger>
                <SelectContent>
                  {devices.outputs.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {localCamera && (
            <div className="border-border aspect-video overflow-hidden rounded-xl border">
              <VideoSurface stream={localCamera} mirrored />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
