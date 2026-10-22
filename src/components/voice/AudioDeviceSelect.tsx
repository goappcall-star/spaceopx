import { Mic, Headphones } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAudioSettings } from "@/hooks/audio-settings-context";

export function AudioDeviceSelect({ kind }: { kind: "input" | "output" }) {
  const { settings, devices, update, supportsOutputSelection } = useAudioSettings();
  const input = kind === "input";
  const value = input ? settings.inputDeviceId : settings.outputDeviceId;
  const list = input ? devices.microphones : devices.outputs;
  const Icon = input ? Mic : Headphones;
  return (
    <Select
      value={value || "default"}
      disabled={!input && !supportsOutputSelection}
      onValueChange={(id) =>
        update(
          input
            ? { inputDeviceId: id === "default" ? null : id }
            : { outputDeviceId: id === "default" ? null : id },
        )
      }
    >
      <SelectTrigger
        aria-label={input ? "Dispositivo de entrada" : "Dispositivo de saída"}
        className="audio-device-select"
      >
        <Icon size={15} className="shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">Padrão do sistema</SelectItem>
        {list
          .filter((d) => d.deviceId !== "default")
          .map((d) => (
            <SelectItem value={d.deviceId} key={d.deviceId}>
              {d.label}
            </SelectItem>
          ))}
        {value && value !== "default" && !list.some((d) => d.deviceId === value) && (
          <SelectItem value={value}>Dispositivo indisponível · selecione outro</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
