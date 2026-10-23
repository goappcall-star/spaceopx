import { createContext, useContext } from "react";
import type { RemoteMedia } from "../../src/services/voice";
export const PlaybackFixture = createContext({
  remoteMedia: {} as Record<string, RemoteMedia>,
  volumes: {} as Record<string, number>,
  deafened: false,
  restrictions: {} as Record<string, { muted: boolean; deafened: boolean }>,
  activeServerId: "isolated-test",
  outputVolume: 100,
});
export const useVoice = () => useContext(PlaybackFixture);
export const useAudioSettings = () => ({
  settings: { outputVolume: useContext(PlaybackFixture).outputVolume, outputDeviceId: null },
});
export const useScreenVolumes = () => ({});
export const useScreenViewing = () => ({ voicePaused: false });
