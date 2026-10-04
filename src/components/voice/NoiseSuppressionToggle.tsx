import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAudioSettings } from "@/hooks/use-audio-settings";

export function NoiseSuppressionToggle() {
  const { settings, update } = useAudioSettings();
  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getSupportedConstraints?.().noiseSuppression;
  const label = supported
    ? `Supressão de ruídos: ${settings.noiseSuppression ? "ativada" : "desativada"}`
    : "Supressão de ruídos indisponível neste navegador";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={settings.noiseSuppression ? "secondary" : "ghost"}
          aria-label={label}
          aria-pressed={settings.noiseSuppression}
          disabled={!supported}
          onClick={() => update({ noiseSuppression: !settings.noiseSuppression })}
        >
          <AudioLines className={settings.noiseSuppression ? "text-primary h-5 w-5" : "h-5 w-5"} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
