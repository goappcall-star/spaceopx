import { ScreenShareDialog } from "@/components/voice/ScreenShareDialog";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CallProviderRoot } from "@/hooks/use-call";
import { VoiceProviderRoot } from "@/hooks/use-voice";
import { RemoteAudio } from "@/components/voice/RemoteAudio";
import { CallAudioPlayback } from "@/components/call/CallOverlay";
import { IncomingCallDialog } from "@/components/call/IncomingCallDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useNavigate } from "@tanstack/react-router";
import { ProfileDialogProvider } from "@/components/gamer/ProfileDialog";
import { SessionCallDock } from "./SessionCallDock";
import { useMentionNotifications } from "@/hooks/use-mention-notifications";
import { VoiceAfkManager } from "@/components/voice/VoiceAfkManager";
import { CallSoundEffects } from "@/components/call/CallSoundEffects";
import { ScreenViewingProvider } from "./ScreenViewingProvider";

const ServerContext = createContext<{
  serverId: string | null;
  setServerId: React.Dispatch<React.SetStateAction<string | null>>;
  conversationReturn: string | null;
  setConversationReturn: React.Dispatch<React.SetStateAction<string | null>>;
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
  const [conversationReturn, setConversationReturn] = useState<string | null>(null);
  const navigate = useNavigate();
  const [voiceReturn, setVoiceReturn] = useState<{ serverId: string; channelId: string } | null>(
    null,
  );
  return (
    <ServerContext.Provider
      value={{
        serverId,
        setServerId,
        voiceReturn,
        setVoiceReturn,
        conversationReturn,
        setConversationReturn,
      }}
    >
      <VoiceProviderRoot serverId={serverId} userId={user?.id}>
        <CallProviderRoot userId={user?.id} profile={profile}>
          <ScreenViewingProvider>
            <TooltipProvider delayDuration={200}>
              <RemoteAudio />
              <VoiceAfkManager />
              <CallAudioPlayback />
              <CallSoundEffects />
              <IncomingCallDialog />
              <ScreenShareDialog />
              <ProfileDialogProvider
                onStartDirect={(id) => {
                  setConversationReturn(id);
                  void navigate({ to: "/app", search: {} });
                }}
              >
                <div className="session-communications-layout">
                  <div className="session-route-content">{children}</div>
                  <SessionCallDock />
                </div>
              </ProfileDialogProvider>
            </TooltipProvider>
          </ScreenViewingProvider>
        </CallProviderRoot>
      </VoiceProviderRoot>
    </ServerContext.Provider>
  );
}
