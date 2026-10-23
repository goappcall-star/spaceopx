/* eslint-disable react-refresh/only-export-components -- Local preview adapters without backend or media capture. */
import { createContext, useContext, useState, type ReactNode } from "react";
const Context = createContext<ReturnType<typeof useStateValue> | null>(null);
function useStateValue() {
  const [local, setLocal] = useState(true),
    [remote, setRemote] = useState(true),
    [muted, setMuted] = useState(false),
    [deafened, setDeafened] = useState(false);
  const [stream] = useState(() => new MediaStream());
  return { local, setLocal, remote, setRemote, muted, setMuted, deafened, setDeafened, stream };
}
export function PreviewProviders({ children }: { children: ReactNode }) {
  const value = useStateValue();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const usePreview = () => useContext(Context)!;
export function useAuth() {
  return {
    user: { id: "fixture" },
    profile: {
      id: "fixture",
      display_name: "Você (prévia)",
      username: "fixture",
      avatar_url: null,
    },
  };
}
export function useVoice() {
  const c = usePreview();
  return {
    muted: c.muted,
    deafened: c.deafened,
    cameraOn: false,
    screenOn: c.local,
    cameraPermission: "granted",
    toggleMute: () => c.setMuted(!c.muted),
    toggleDeafen: () => c.setDeafened(!c.deafened),
    toggleCamera: async () => {},
    toggleScreenShare: async () => c.setLocal(false),
    pttActive: true,
    leave: async () => {},
    remoteMedia: c.remote ? { other: { audio: null, screen: c.stream, screenAudio: null } } : {},
    activeChannelId: "fixture-voice",
  };
}
export function useCall() {
  const c = usePreview();
  return {
    status: "active",
    peer: {
      id: "other",
      display_name: "Participante fictício",
      username: "other",
      avatar_url: null,
    },
    participants: [],
    groupConversationId: null,
    groupMedia: {},
    remote: { audio: null, camera: null, screen: c.remote ? c.stream : null, screenAudio: null },
    muted: c.muted,
    screenOn: c.local,
    cameraOn: false,
    localScreen: c.local ? c.stream : null,
    localCamera: null,
    speakingUsers: {},
    aloneDeadline: null,
    toggleScreenShare: async () => c.setLocal(false),
    toggleMute: () => c.setMuted(!c.muted),
    toggleCamera: async () => {},
    hangUp: () => {},
    dismiss: () => {},
  };
}
export function useAudioSettings() {
  return {
    settings: {
      inputMode: "open",
      pttKey: "Space",
      inputVolume: 100,
      outputVolume: 100,
      noiseSuppression: "standard",
    },
    noiseProcessing: {},
    devices: { microphones: [], outputs: [] },
    refreshDevices: async () => {},
    update: () => {},
    supportsOutputSelection: false,
  };
}
export const keyLabel = (key: string) => key;
export const supportsScreenShare = () => true;
export const supportsCamera = () => true;
export const NOISE_MODE_LABELS = { off: "Desligada", standard: "Padrão", advanced: "Avançada" };
export function DeviceSettingsDialog() {
  return null;
}
export const conversationsService = { openDirect: async () => "fixture" };
