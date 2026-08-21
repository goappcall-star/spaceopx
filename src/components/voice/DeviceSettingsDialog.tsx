import { useEffect } from "react";

import { AudioSettingsPanel } from "@/components/settings/AudioSettingsPanel";
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
  const { devices, selectedDevices, selectDevice, refreshDevices, localCamera } = useVoice();

  useEffect(() => {
    if (open) void refreshDevices();
  }, [open, refreshDevices]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Voz e vídeo</DialogTitle>
          <DialogDescription>
            Dispositivos, volumes e modo de entrada — salvos na sua conta.
          </DialogDescription>
        </DialogHeader>

        <AudioSettingsPanel compact />

        <div className="border-border space-y-3 border-t pt-6">
          <h3 className="text-sm font-semibold tracking-wide uppercase">Vídeo</h3>
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
          {localCamera && (
            <div className="overflow-hidden rounded-xl">
              <VideoSurface stream={localCamera} muted mirrored />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
