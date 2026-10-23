import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";
import { useVoice } from "@/hooks/use-voice";
import { useCall } from "@/hooks/use-call";

const ScreenViewingContext = createContext({
  voicePaused: false,
  callPaused: false,
  setVoicePaused: (_paused: boolean) => {},
  setCallPaused: (_paused: boolean) => {},
});
export const useScreenViewing = () => useContext(ScreenViewingContext);

/** Receiver playback only. Never stops shared tracks or changes the voice connection. */
export function ScreenViewingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const voice = useVoice(),
    call = useCall();
  const voiceScope = `${user?.id}:${voice.activeChannelId}`;
  const callScope = `${user?.id}:${call.groupConversationId ?? call.peer?.id}:${call.status === "idle" || call.status === "ended"}`;
  const [voiceState, setVoiceState] = useState({ scope: voiceScope, paused: false });
  const [callState, setCallState] = useState({ scope: callScope, paused: false });
  const voiceHasScreen = Object.values(voice.remoteMedia).some((media) => media.screen);
  const callHasScreen =
    !!call.remote?.screen || Object.values(call.groupMedia).some((media) => media.screen);
  useEffect(() => {
    if (!voiceHasScreen) setVoiceState({ scope: voiceScope, paused: false });
  }, [voiceHasScreen, voiceScope]);
  useEffect(() => {
    if (!callHasScreen) setCallState({ scope: callScope, paused: false });
  }, [callHasScreen, callScope]);
  const voicePaused = voiceState.scope === voiceScope && voiceState.paused;
  const callPaused = callState.scope === callScope && callState.paused;
  const setVoicePaused = useCallback(
    (paused: boolean) => setVoiceState({ scope: voiceScope, paused }),
    [voiceScope],
  );
  const setCallPaused = useCallback(
    (paused: boolean) => setCallState({ scope: callScope, paused }),
    [callScope],
  );
  const value = useMemo(
    () => ({ voicePaused, callPaused, setVoicePaused, setCallPaused }),
    [voicePaused, callPaused, setVoicePaused, setCallPaused],
  );
  return <ScreenViewingContext.Provider value={value}>{children}</ScreenViewingContext.Provider>;
}
