/* eslint-disable react-refresh/only-export-components -- Offline preview adapters, never an application backend. */
import {
  createContext,
  useContext,
  useState,
  forwardRef,
  type ReactNode,
  type ComponentPropsWithoutRef,
} from "react";
export const scenarios = [
  "Fora de chamada",
  "Conectando",
  "Em chamada",
  "Transmitindo",
  "Assistindo",
  "Reconectando",
  "Chamada privada",
  "Chamada em grupo",
  "Duas chamadas",
];
function usePreviewState() {
  const [scenario, setScenario] = useState(scenarios[0]),
    [page, setPage] = useState("Servidor LobbyX"),
    [account, setAccount] = useState("fixture"),
    [muted, setMuted] = useState(false),
    [deafened, setDeafened] = useState(false),
    [camera, setCamera] = useState(false),
    [events, setEvents] = useState<string[]>([]),
    [settings, setSettings] = useState({
      inputMode: "open",
      pttKey: "Space",
      inputVolume: 100,
      outputVolume: 100,
      inputDeviceId: "default",
      outputDeviceId: "default",
      noiseSuppression: "standard",
    });
  const [stream] = useState(() => new MediaStream());
  return {
    scenario,
    setScenario,
    page,
    setPage,
    account,
    setAccount,
    muted,
    setMuted,
    deafened,
    setDeafened,
    camera,
    setCamera,
    events,
    setEvents,
    settings,
    setSettings,
    stream,
  };
}
const Context = createContext<ReturnType<typeof usePreviewState> | null>(null);
export const usePreview = () => useContext(Context)!;
export function PreviewProviders({ children }: { children: ReactNode }) {
  const state = usePreviewState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const people = [
  { id: "fixture", name: "Nicooo" },
  { id: "one", name: "Lara" },
  { id: "two", name: "Rafa" },
  { id: "three", name: "Biel" },
  { id: "four", name: "Guh" },
];
export function useAuth() {
  const c = usePreview();
  return {
    user: { id: c.account },
    profile: {
      id: c.account,
      display_name: c.account === "fixture" ? "Nicooo" : "Conta de teste",
      username: c.account === "fixture" ? "nico" : "teste",
      avatar_url: "/lobbyx-logo.png",
      avatar_frame: "royal",
    },
  };
}
export function useVoice() {
  const c = usePreview();
  const active = [
    "Conectando",
    "Em chamada",
    "Transmitindo",
    "Assistindo",
    "Reconectando",
    "Duas chamadas",
  ].includes(c.scenario);
  return {
    activeChannelId: active ? "voice-a" : null,
    activeServerId: active ? "server-a" : null,
    connectionState:
      c.scenario === "Reconectando"
        ? "reconnecting"
        : c.scenario === "Conectando"
          ? "connecting"
          : active
            ? "connected"
            : "disconnected",
    muted: c.muted,
    deafened: c.deafened,
    cameraOn: c.camera,
    screenOn: c.scenario === "Transmitindo",
    localScreen: c.scenario === "Transmitindo" ? c.stream : null,
    cameraPermission: "granted",
    pttActive: true,
    participantsByChannel: {
      "voice-a": active
        ? people.map((p) => ({ user_id: p.id, muted: false, deafened: false }))
        : [],
    },
    remoteMedia:
      c.scenario === "Assistindo"
        ? { one: { audio: null, screen: c.stream, screenAudio: null } }
        : {},
    toggleMute: () => c.setMuted(!c.muted),
    toggleDeafen: () => {
      c.setDeafened(!c.deafened);
      if (!c.deafened) c.setMuted(true);
    },
    toggleCamera: async () => c.setCamera(!c.camera),
    toggleScreenShare: async () => {
      c.setEvents((e) => [...e, "Compartilhamento encerrado; voz preservada."]);
      c.setScenario("Em chamada");
    },
    leave: async () => {
      c.setEvents((e) => [...e, "Desconectado da voz."]);
      c.setScenario("Fora de chamada");
    },
  };
}
export function useCall() {
  const c = usePreview();
  const active = ["Chamada privada", "Chamada em grupo", "Duas chamadas"].includes(c.scenario);
  return {
    status: active ? "active" : "idle",
    peer: {
      id: "one",
      display_name: c.scenario === "Chamada em grupo" ? "Grupo de teste" : "Lara",
      avatar_url: null,
    },
    groupConversationId: c.scenario === "Chamada em grupo" ? "group-fixture" : null,
    participants:
      c.scenario === "Chamada em grupo"
        ? people.slice(0, 3).map((p) => ({ id: p.id, display_name: p.name, avatar_url: null }))
        : [],
    groupMedia: {},
    remote: null,
    screenOn: false,
    localScreen: null,
    muted: c.muted,
    cameraOn: c.camera,
    toggleMute: () => c.setMuted(!c.muted),
    toggleCamera: async () => c.setCamera(!c.camera),
    toggleScreenShare: async () => {},
    hangUp: () => {
      c.setScenario("Fora de chamada");
      c.setEvents((e) => [...e, "Chamada encerrada."]);
    },
  };
}
export function useMyServers() {
  return {
    data: [
      { id: "server-a", name: "LobbyX · servidor da chamada" },
      { id: "server-b", name: "Outro servidor" },
    ],
  };
}
export function useServerChannels() {
  return { data: [{ id: "voice-a", name: "Conversa Geral" }] };
}
export function useServerMembers() {
  return {
    data: people.map((p) => ({
      user_id: p.id,
      profile: { display_name: p.name, avatar_url: "/lobbyx-logo.png" },
    })),
  };
}
export function useAudioSettings() {
  const c = usePreview();
  return {
    settings: c.settings,
    update: (update: Partial<typeof c.settings>) => c.setSettings((old) => ({ ...old, ...update })),
    noiseProcessing: {},
    devices: {
      microphones: [{ deviceId: "mic-fixture", label: "Microfone fictício" }],
      outputs: [{ deviceId: "output-fixture", label: "Fone fictício" }],
    },
    supportsOutputSelection: true,
    refreshDevices: async () => {},
  };
}
export const keyLabel = (key: string) => key;
export const supportsCamera = () => true,
  supportsScreenShare = () => true;
export const NOISE_MODE_LABELS = { off: "Desligada", standard: "Padrão", advanced: "Avançada" };
export function DeviceSettingsDialog() {
  return null;
}
export function useSessionServer() {
  const c = usePreview();
  return {
    setVoiceReturn: () => c.setPage("Conversa Geral · LobbyX"),
    setConversationReturn: () => c.setPage("Mensagens"),
  };
}
export function useNavigate() {
  const c = usePreview();
  return async ({ to }: { to: string }) => {
    if (to !== "/app") c.setPage(to.startsWith("/settings") ? "Configurações" : "Login");
  };
}
export function useGlobalPresence() {
  return { myStatus: "online", setStatus: async () => {}, connection: "connected" };
}
export function teardownPresence() {}
export function useProfileDialog() {
  return { openProfile: () => {} };
}
export function useQueryClient() {
  return { cancelQueries: async () => {}, clear: () => {}, removeQueries: () => {} };
}
export const conversationsService = { openDirect: async () => "conversation-fixture" },
  authService = { signOut: async () => {} };
export const Link = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<"a"> & { to?: string }>(
  ({ to, ...props }, ref) => {
    const c = usePreview();
    return (
      <a
        {...props}
        ref={ref}
        href="#"
        onClick={(e) => {
          e.preventDefault();
          c.setPage(to?.startsWith("/settings") ? "Configurações" : "Servidor LobbyX");
          props.onClick?.(e);
        }}
      />
    );
  },
);
Link.displayName = "PreviewLink";
