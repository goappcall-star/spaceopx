/* eslint-disable react-refresh/only-export-components -- Isolated preview adapters; never bundled into the application. */
import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ReactNode,
  type ComponentPropsWithoutRef,
} from "react";
const Context = createContext<ReturnType<typeof usePreviewState> | null>(null);
function usePreviewState() {
  const [muted, mute] = useState(false),
    [deafened, deafen] = useState(false),
    [status, setStatus] = useState("online"),
    [settings, setSettings] = useState({
      inputMode: "open",
      pttKey: "Space",
      inputDeviceId: "default",
      outputDeviceId: "default",
      inputVolume: 100,
      outputVolume: 100,
    });
  return { muted, mute, deafened, deafen, status, setStatus, settings, setSettings };
}
export function PreviewProviders({ children }: { children: ReactNode }) {
  const value = usePreviewState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function usePreviewContext() {
  return useContext(Context)!;
}
export function useAuth() {
  return {
    profile: {
      id: "fixture",
      display_name: "Nicooo",
      username: "nico",
      avatar_url: "/lobbyx-logo.png",
      avatar_frame: "royal",
      banner_url: null,
    },
    user: { id: "fixture" },
  };
}
export function useVoice() {
  const c = usePreviewContext();
  return {
    muted: c.muted,
    deafened: c.deafened,
    toggleMute: () => c.mute((v) => !v),
    toggleDeafen: () => c.deafen((v) => !v),
    pttActive: false,
    activeChannelId: null,
  };
}
export function useGlobalPresence() {
  const c = usePreviewContext();
  return { myStatus: c.status, setStatus: c.setStatus, connection: "connected" };
}
export function teardownPresence() {}
export function useAudioSettings() {
  const c = usePreviewContext();
  return {
    settings: c.settings,
    update: (update: Partial<typeof c.settings>) => c.setSettings((old) => ({ ...old, ...update })),
    devices: {
      microphones: [{ deviceId: "fixture-mic", label: "Microfone fictício" }],
      outputs: [{ deviceId: "fixture-output", label: "Fone fictício" }],
    },
    refreshDevices: async () => {},
    supportsOutputSelection: true,
  };
}
export function keyLabel(key: string) {
  return key;
}
export const Link = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<"a"> & { to?: string; search?: unknown }
>(({ to, search: _search, ...props }, ref) => (
  <a
    ref={ref}
    {...props}
    href="#"
    onClick={(event) => {
      event.preventDefault();
      props.onClick?.(event);
    }}
    data-preview-route={to}
  />
));
Link.displayName = "PreviewLink";
export function useNavigate() {
  return async () => {};
}
export function useQueryClient() {
  return { cancelQueries: async () => {}, clear: () => {}, removeQueries: () => {} };
}
export const authService = { signOut: async () => {} };
export function useProfileDialog() {
  return { openProfile: () => {} };
}
export function ConnectedVoiceBar() {
  return null;
}
export function DeviceSettingsDialog() {
  return null;
}
