import { createContext, useContext } from "react";
import type { AudioInputMode } from "@/types";
import type { MediaDeviceList } from "@/services/voice";
import type { NoiseProcessingStatus, NoiseSuppressionMode } from "@/services/audio-processing";

export interface AudioSettings {
  callSoundsEnabled: boolean;
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  inputVolume: number;
  outputVolume: number;
  inputMode: AudioInputMode;
  pttKey: string;
  noiseSuppression: NoiseSuppressionMode;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  callSoundsEnabled: true,
  inputDeviceId: null,
  outputDeviceId: null,
  inputVolume: 100,
  outputVolume: 100,
  inputMode: "open",
  pttKey: "KeyV",
  noiseSuppression: "standard",
};

export interface AudioSettingsContextValue {
  settings: AudioSettings;
  update: (patch: Partial<AudioSettings>) => void;
  devices: MediaDeviceList;
  refreshDevices: () => Promise<void>;
  supportsOutputSelection: boolean;
  loaded: boolean;
  sessionKey: string | null;
  noiseProcessing: Record<string, NoiseProcessingStatus>;
  reportNoiseProcessing: (session: string, status: NoiseProcessingStatus | null) => void;
}

export const AudioSettingsContext = createContext<AudioSettingsContextValue | undefined>(undefined);

export function useAudioSettings() {
  const ctx = useContext(AudioSettingsContext);
  if (!ctx) throw new Error("useAudioSettings must be used inside <AudioSettingsProvider>");
  return ctx;
}
export function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Espaço";
  return code;
}
