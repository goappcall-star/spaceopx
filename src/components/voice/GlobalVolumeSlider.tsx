import { useId } from "react";
import { Slider } from "@/components/ui/slider";
import { clampGlobalVolume } from "@/lib/audio-volume";

export function GlobalVolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="audio-volume-field">
      <div>
        <label id={id}>{label}</label>
        <output>{clampGlobalVolume(value)}%</output>
      </div>
      <Slider
        aria-labelledby={id}
        thumbLabel={label}
        value={[clampGlobalVolume(value)]}
        min={0}
        max={100}
        step={1}
        onValueChange={([next]) => onChange(clampGlobalVolume(next))}
      />
    </div>
  );
}
