import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CallProviderRoot } from "@/hooks/use-call";
import { VoiceProviderRoot } from "@/hooks/use-voice";
import { RemoteAudio } from "@/components/voice/RemoteAudio";
import { CallAudioPlayback } from "@/components/call/CallOverlay";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useRouterState } from "@tanstack/react-router";
import { ConnectedVoiceBar } from "@/components/voice/ConnectedVoiceBar";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { VoiceAfkManager } from "@/components/voice/VoiceAfkManager";
import { CallSoundEffects } from "@/components/call/CallSoundEffects";

const ServerContext = createContext<{
  serverId: string | null;
  setServerId: React.Dispatch<React.SetStateAction<string | null>>;
  voiceReturn: { serverId: string; channelId: string } | null;
  setVoiceReturn: React.Dispatch<
    React.SetStateAction<{ serverId: string; channelId: string } | null>
  >;
} | null>(null);
export function useSessionServer() {
  const context = useContext(ServerContext);
  if (!context) throw new Error("Missing session communications");
  return context;
}
/** Owns media for the entire signed-in session, independently of the visible route. */
export function SessionCommunications({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  useMentionNotifications(user?.id);
  const [serverId, setServerId] = useState<string | null>(null);
  const [voiceReturn, setVoiceReturn] = useState<{ serverId: string; channelId: string } | null>(
    null,
  );
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <ServerContext.Provider value={{ serverId, setServerId, voiceReturn, setVoiceReturn }}>
      <VoiceProviderRoot serverId={serverId} userId={user?.id}>
        <CallProviderRoot userId={user?.id} profile={profile}>
          <TooltipProvider delayDuration={200}>
            <RemoteAudio />
            <VoiceAfkManager />
            <CallAudioPlayback />
            <CallSoundEffects />
            <IncomingCallDialog />
            {children}
            {pathname !== "/app" && <ConnectedVoiceBar floating />}
          </TooltipProvider>
        </CallProviderRoot>
      </VoiceProviderRoot>
    </ServerContext.Provider>
  );
}
