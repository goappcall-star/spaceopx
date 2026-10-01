import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CallProviderRoot } from "@/hooks/use-call";
import { VoiceProviderRoot } from "@/hooks/use-voice";
import { RemoteAudio } from "@/components/voice/RemoteAudio";
import { CallAudioPlayback } from "@/components/call/CallOverlay";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { TooltipProvider } from "@/components/ui/tooltip";

const ServerContext = createContext<{
  serverId: string | null;
  setServerId: React.Dispatch<React.SetStateAction<string | null>>;
} | null>(null);
export function useSessionServer() {
  const context = useContext(ServerContext);
  if (!context) throw new Error("Missing session communications");
  return context;
}
/** Owns media for the entire signed-in session, independently of the visible route. */
export function SessionCommunications({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [serverId, setServerId] = useState<string | null>(null);
  return (
    <ServerContext.Provider value={{ serverId, setServerId }}>
      <VoiceProviderRoot serverId={serverId} userId={user?.id}>
        <CallProviderRoot userId={user?.id} profile={profile}>
          <TooltipProvider delayDuration={200}>
            <RemoteAudio />
            <CallAudioPlayback />
            <IncomingCallDialog />
            {children}
          </TooltipProvider>
        </CallProviderRoot>
      </VoiceProviderRoot>
    </ServerContext.Provider>
  );
}
