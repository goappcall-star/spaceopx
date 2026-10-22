import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { preferencesService } from "@/services/gamer";
import { listMediaDevices, type MediaDeviceList } from "@/services/voice";
import {
  AudioSettingsContext,
  DEFAULT_AUDIO_SETTINGS,
  type AudioSettings,
  type AudioSettingsContextValue,
} from "./audio-settings-context";
export { useAudioSettings, keyLabel, DEFAULT_AUDIO_SETTINGS } from "./audio-settings-context";
import { clampGlobalVolume } from "@/lib/audio-volume";
import type { NoiseProcessingStatus } from "@/services/audio-processing";
import { readNoiseMode, saveNoiseMode } from "@/services/noise-preference";
import { readCallSounds, saveCallSounds } from "@/services/call-sounds";

/** Single persistent source of truth for audio hardware and voice input preferences. */
export function AudioSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState<AudioSettings>(DEFAULT_AUDIO_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceList>({
    microphones: [],
    cameras: [],
    outputs: [],
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [noiseProcessing, setNoiseProcessing] = useState<Record<string, NoiseProcessingStatus>>({});
  const reportNoiseProcessing = useCallback(
    (session: string, status: NoiseProcessingStatus | null) => {
      setNoiseProcessing((prev) => {
        const next = { ...prev };
        if (status) next[session] = status;
        else delete next[session];
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSettings(DEFAULT_AUDIO_SETTINGS);
    if (!userId) {
      setSettings(DEFAULT_AUDIO_SETTINGS);
      setLoaded(false);
      return;
    }
    void preferencesService
      .get(userId)
      .then((prefs) => {
        if (cancelled) return;
        setSettings({
          callSoundsEnabled: readCallSounds(userId),
          inputDeviceId: prefs.input_device_id ?? null,
          outputDeviceId: prefs.output_device_id ?? null,
          inputVolume: clampGlobalVolume(prefs.input_volume),
          outputVolume: clampGlobalVolume(prefs.output_volume),
          inputMode: prefs.input_mode ?? "open",
          pttKey: prefs.ptt_key ?? "KeyV",
          noiseSuppression: readNoiseMode(userId),
        });
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [userId]);

  const update = useCallback(
    (patch: Partial<AudioSettings>) => {
      setSettings((prev) => {
        const next = {
          ...prev,
          ...patch,
          inputVolume: clampGlobalVolume(patch.inputVolume ?? prev.inputVolume),
          outputVolume: clampGlobalVolume(patch.outputVolume ?? prev.outputVolume),
        };
        if (user) {
          if (patch.callSoundsEnabled !== undefined)
            saveCallSounds(user.id, next.callSoundsEnabled);
          if (patch.noiseSuppression !== undefined) saveNoiseMode(user.id, next.noiseSuppression);
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

  const currentSettings = useRef(settings);
  currentSettings.current = settings;
  const previousDevices = useRef<MediaDeviceList | null>(null);
  const deviceRequest = useRef(0);
  const refreshDevices = useCallback(async () => {
    const version = ++deviceRequest.current;
    try {
      const next = await listMediaDevices();
      if (version !== deviceRequest.current) return;
      const previous = previousDevices.current;
      previousDevices.current = next;
      setDevices(next);
      // An empty enumeration may mean no permission. A populated list also lets stale saved devices fall back safely.
      const patch: Partial<AudioSettings> = {};
      const current = currentSettings.current;
      if (
        current.inputDeviceId &&
        current.inputDeviceId !== "default" &&
        (next.microphones.length > 0 ||
          previous?.microphones.some((d) => d.deviceId === current.inputDeviceId)) &&
        !next.microphones.some((d) => d.deviceId === current.inputDeviceId)
      )
        patch.inputDeviceId = null;
      if (
        current.outputDeviceId &&
        current.outputDeviceId !== "default" &&
        (next.outputs.length > 0 ||
          previous?.outputs.some((d) => d.deviceId === current.outputDeviceId)) &&
        !next.outputs.some((d) => d.deviceId === current.outputDeviceId)
      )
        patch.outputDeviceId = null;
      if (Object.keys(patch).length) update(patch);
    } catch {
      /* Enumeration unsupported; keep existing selection visible instead of guessing. */
    }
  }, [update]);

  useEffect(() => {
    void refreshDevices();
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
  }, [refreshDevices]);

  useEffect(() => {
    if (loaded) void refreshDevices();
  }, [loaded, refreshDevices]);

  const supportsOutputSelection =
    typeof window !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;

  const value = useMemo<AudioSettingsContextValue>(
    () => ({
      settings,
      sessionKey: userId ?? null,
      update,
      devices,
      refreshDevices,
      supportsOutputSelection,
      loaded,
      noiseProcessing,
      reportNoiseProcessing,
    }),
    [
      settings,
      userId,
      update,
      devices,
      refreshDevices,
      supportsOutputSelection,
      loaded,
      noiseProcessing,
      reportNoiseProcessing,
    ],
  );

  return <AudioSettingsContext.Provider value={value}>{children}</AudioSettingsContext.Provider>;
}
