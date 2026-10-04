import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { NOISE_MODE_LABELS, type NoiseSuppressionMode } from "@/services/audio-processing";
export function NoiseModeSelect({ id }: { id?: string }) {
  const { settings, update } = useAudioSettings();
  return (
    <Select
      value={settings.noiseSuppression}
      onValueChange={(mode) => update({ noiseSuppression: mode as NoiseSuppressionMode })}
    >
      <SelectTrigger id={id} aria-label="Supressão de ruído">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(NOISE_MODE_LABELS).map(([mode, label]) => (
          <SelectItem key={mode} value={mode}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function NoiseProcessingFeedback() {
  const { noiseProcessing } = useAudioSettings();
  const statuses = Object.values(noiseProcessing);
  if (statuses.some((status) => status.fallback))
    return (
      <p role="status" className="text-amber-400 text-xs">
        O modo avançado não está disponível nesta chamada. Usando supressão padrão para manter o
        áudio.
      </p>
    );
  if (statuses.some((status) => status.loading))
    return (
      <p role="status" className="text-muted-foreground text-xs">
        Carregando supressão avançada… O áudio continua no modo padrão.
      </p>
    );
  if (statuses.some((status) => status.effective === "advanced"))
    return (
      <p role="status" className="text-primary text-xs">
        Supressão avançada ativa.
      </p>
    );
  return null;
}
