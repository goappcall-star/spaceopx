import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/use-auth";
import { preferencesService } from "@/services/gamer";
import { listMediaDevices, type MediaDeviceList } from "@/services/voice";
import type { AudioInputMode } from "@/types";

export interface AudioSettings {
  inputDeviceId: string | null;
  outputDeviceId: string | null;
  inputVolume: number;
  outputVolume: number;
  inputMode: AudioInputMode;
  pttKey: string;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  inputDeviceId: null,
  outputDeviceId: null,
  inputVolume: 100,
  outputVolume: 100,
  inputMode: "open",
  pttKey: "KeyV",
};

interface AudioSettingsContextValue {
  settings: AudioSettings;
  update: (patch: Partial<AudioSettings>) => void;
  devices: MediaDeviceList;
  refreshDevices: () => Promise<void>;
  supportsOutputSelection: boolean;
  loaded: boolean;
}

const AudioSettingsContext = createContext<AudioSettingsContextValue | undefined>(undefined);

/** Single persistent source of truth for audio hardware and voice input preferences. */
export function AudioSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceList>({
    microphones: [],
    cameras: [],
    outputs: [],
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSettings(DEFAULT_AUDIO_SETTINGS);
      setLoaded(false);
      return;
    }
    void preferencesService
      .get(user.id)
      .then((prefs) => {
        if (cancelled) return;
        setSettings({
          inputDeviceId: prefs.input_device_id ?? null,
          outputDeviceId: prefs.output_device_id ?? null,
          inputVolume: prefs.input_volume ?? 100,
          outputVolume: prefs.output_volume ?? 100,
          inputMode: prefs.input_mode ?? "open",
          pttKey: prefs.ptt_key ?? "KeyV",
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const update = useCallback(
    (patch: Partial<AudioSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (user) {
          if (saveTimer.current) clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            void preferencesService
              .save(user.id, {
                input_device_id: next.inputDeviceId,
                output_device_id: next.outputDeviceId,
                input_volume: next.inputVolume,
                output_volume: next.outputVolume,
                input_mode: next.inputMode,
                ptt_key: next.pttKey,
              })
              .catch(() => undefined);
          }, 400);
        }
        return next;
      });
    },
    [user],
  );

  const refreshDevices = useCallback(async () => {
    try {
      setDevices(await listMediaDevices());
    } catch {
      /* enumeration unsupported */
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshDevices]);

  const supportsOutputSelection =
    typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  const value = useMemo<AudioSettingsContextValue>(
    () => ({ settings, update, devices, refreshDevices, supportsOutputSelection, loaded }),
    [settings, update, devices, refreshDevices, supportsOutputSelection, loaded],
  );

  return <AudioSettingsContext.Provider value={value}>{children}</AudioSettingsContext.Provider>;
}

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
