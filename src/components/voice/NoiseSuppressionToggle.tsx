import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { NOISE_MODE_LABELS } from "@/services/audio-processing";
import { NoiseModeSelect, NoiseProcessingFeedback } from "./NoiseModeSelect";

export function NoiseSuppressionToggle() {
  const { settings, noiseProcessing } = useAudioSettings();
  const fallback = Object.values(noiseProcessing).some((status) => status.fallback);
  const label = `Supressão de ruído: ${NOISE_MODE_LABELS[settings.noiseSuppression]}${fallback ? " (usando padrão)" : ""}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={settings.noiseSuppression !== "off" ? "secondary" : "ghost"}
          aria-label={label}
          title={label}
        >
          <AudioLines
            className={settings.noiseSuppression !== "off" ? "text-primary h-5 w-5" : "h-5 w-5"}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3">
        <p className="text-sm font-semibold">Supressão de ruído</p>
        <NoiseModeSelect />
        <NoiseProcessingFeedback />
      </PopoverContent>
    </Popover>
  );
}
