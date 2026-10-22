import { useCallback, useEffect, useRef, useState } from "react";
import { useAudioSettings } from "./audio-settings-context";
import { MicrophoneTestSession, SpeakerTestSession } from "@/services/microphone-test";

export function useMicrophoneTest() {
  const { settings, sessionKey, refreshDevices, reportNoiseProcessing } = useAudioSettings();
  const [testing, setTesting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [borrowed, setBorrowed] = useState(false);
  const current = useRef<MicrophoneTestSession | null>(null);
  const speaker = useRef<SpeakerTestSession | null>(null);
  const generation = useRef(0);
  const latest = useRef(settings);
  latest.current = settings;
  const stop = useCallback(() => {
    generation.current++;
    current.current?.stop();
    current.current = null;
    speaker.current?.stop();
    speaker.current = null;
    setTesting(false);
    setStarting(false);
    setLevel(0);
    setBorrowed(false);
  }, []);

  // Device/account changes never leave monitoring running in the background.
  useEffect(() => {
    stop();
    const changed = () => stop();
    navigator.mediaDevices?.addEventListener("devicechange", changed);
    return () => {
      stop();
      navigator.mediaDevices?.removeEventListener("devicechange", changed);
    };
  }, [
    sessionKey,
    settings.inputDeviceId,
    settings.outputDeviceId,
    settings.noiseSuppression,
    stop,
  ]);

  useEffect(() => {
    current.current?.setVolumes(settings.inputVolume, settings.outputVolume);
    speaker.current?.setVolume(settings.outputVolume);
  }, [settings.inputVolume, settings.outputVolume]);

  const start = async () => {
    stop();
    const version = generation.current;
    setError("");
    setTesting(true);
    setStarting(true);
    const session = new MicrophoneTestSession(stop, (status) =>
      reportNoiseProcessing("test", status),
    );
    current.current = session;
    session.setVolumes(settings.inputVolume, settings.outputVolume);
    try {
      await session.start(settings, setLevel);
      if (version !== generation.current) return;
      session.setVolumes(latest.current.inputVolume, latest.current.outputVolume);
      setStarting(false);
      setBorrowed(session.borrowed);
      void refreshDevices();
    } catch (e) {
      session.stop();
      if (version !== generation.current) return;
      stop();
      setError(
        e instanceof Error
          ? `Não foi possível iniciar o retorno: ${e.message}`
          : "Não foi possível acessar o microfone.",
      );
    }
  };
  const testOutput = async () => {
    speaker.current?.stop();
    const session = new SpeakerTestSession();
    speaker.current = session;
    const version = generation.current;
    setError("");
    try {
      await session.start(settings.outputDeviceId, settings.outputVolume);
    } catch (e) {
      session.stop();
      if (version === generation.current)
        setError(e instanceof Error ? e.message : "Não foi possível testar a saída.");
    }
  };
  return { testing, starting, level, borrowed, error, start, stop, testOutput };
}
