import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Square, LogOut, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useVoice } from "@/hooks/use-voice";
import { useCall } from "@/hooks/use-call";
import { useAudioSettings, keyLabel } from "@/hooks/use-audio-settings";
import { useMyServers, useServerChannels, useServerMembers } from "@/hooks/use-servers";
import { UserBar } from "@/components/app/UserBar";
import { AudioInputControl, AudioOutputControl } from "@/components/voice/AudioOutputControl";
import { VoiceIcon } from "@/components/voice/VoiceIcon";
import { NoiseSuppressionToggle } from "@/components/voice/NoiseSuppressionToggle";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  activePrivateCall,
  resolveCallDockTarget,
  uniqueDockParticipants,
  type CallDockTarget,
  type DockParticipant,
} from "@/lib/call-dock";
import { supportsCamera, supportsScreenShare } from "@/services/voice";
import { openScreenSharePanel } from "@/services/screen-share-panel";
import { conversationsService } from "@/services/social";
import { useSessionServer } from "./SessionCommunications";
import { useScreenViewing } from "./ScreenViewingProvider";
import { CallDockView } from "./CallDockView";

function DockButton({
  label,
  tooltip,
  disconnect = false,
  active = false,
  danger = false,
  text,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  tooltip?: string;
  disconnect?: boolean;
  active?: boolean;
  danger?: boolean;
  text?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`session-call-button${text ? " session-call-stream-action" : ""}${disconnect ? " session-call-disconnect" : ""}`}
          data-active={active}
          data-danger={danger}
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
          {text && <span>{label}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip ?? label}</TooltipContent>
    </Tooltip>
  );
}

/** One view/controller adapter for the existing voice and private-call contexts. */
export function SessionCallDock() {
  const voice = useVoice(),
    call = useCall(),
    viewing = useScreenViewing();
  const { profile } = useAuth(),
    { settings } = useAudioSettings();
  const navigate = useNavigate();
  const { setVoiceReturn, setConversationReturn } = useSessionServer();
  const [preferred, setPreferred] = useState<CallDockTarget>("call");
  const target = resolveCallDockTarget(!!voice.activeChannelId, call.status, preferred);
  const privateSelected = target === "call";
  const { data: servers = [] } = useMyServers(!!voice.activeServerId);
  const { data: channels = [] } = useServerChannels(voice.activeServerId);
  const { data: members = [] } = useServerMembers(voice.activeServerId);
  const server = servers.find((item) => item.id === voice.activeServerId);
  const channel = channels.find((item) => item.id === voice.activeChannelId);
  const current = privateSelected ? call : voice;
  const ready = privateSelected
    ? ["active", "waiting"].includes(call.status)
    : voice.connectionState === "connected";
  const remoteSharing = privateSelected
    ? !!call.remote?.screen || Object.values(call.groupMedia).some((media) => media.screen)
    : Object.values(voice.remoteMedia).some((media) => media.screen);
  const paused = privateSelected ? viewing.callPaused : viewing.voicePaused;
  const setPaused = privateSelected ? viewing.setCallPaused : viewing.setVoicePaused;
  const self: DockParticipant | null = profile
    ? {
        id: profile.id,
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
        avatarFrame: profile.avatar_frame,
      }
    : null;
  const privatePeople = call.groupConversationId
    ? call.participants.map((person) => ({
        id: person.id,
        name: person.display_name,
        avatarUrl: person.avatar_url,
        avatarFrame: person.avatar_frame,
      }))
    : [
        ...(self && ["active", "waiting", "reconnecting"].includes(call.status) ? [self] : []),
        ...(call.peer && ["active", "reconnecting"].includes(call.status)
          ? [
              {
                id: call.peer.id,
                name: call.peer.display_name,
                avatarUrl: call.peer.avatar_url,
                avatarFrame: call.peer.avatar_frame,
              },
            ]
          : []),
      ];
  const voicePeople = (
    voice.activeChannelId ? (voice.participantsByChannel[voice.activeChannelId] ?? []) : []
  ).map((person) => {
    const member = members.find((item) => item.user_id === person.user_id);
    return {
      id: person.user_id,
      name:
        member?.nickname ??
        member?.profile?.display_name ??
        (person.user_id === profile?.id ? profile.display_name : "Usuário"),
      avatarUrl:
        member?.profile?.avatar_url ?? (person.user_id === profile?.id ? profile.avatar_url : null),
      avatarFrame:
        member?.profile?.avatar_frame ??
        (person.user_id === profile?.id ? profile.avatar_frame : undefined),
    };
  });
  async function returnToCall() {
    if (!privateSelected && voice.activeChannelId && voice.activeServerId) {
      setVoiceReturn({ serverId: voice.activeServerId, channelId: voice.activeChannelId });
      await navigate({ to: "/app", search: {} });
      return;
    }
    if (privateSelected && call.peer)
      try {
        const id =
          call.groupConversationId ?? (await conversationsService.openDirect(call.peer.id));
        setConversationReturn(id);
        await navigate({ to: "/app", search: {} });
      } catch {
        toast.error("Não foi possível abrir a conversa da chamada.");
      }
  }
  const ptt = !privateSelected && settings.inputMode === "ptt";
  const state = privateSelected
    ? ({
        outgoing: "Chamando…",
        connecting: "Conectando…",
        active: "Conectado",
        waiting: "Aguardando participantes",
        reconnecting: "Reconectando…",
        idle: "Desconectado",
        incoming: "Chamada recebida",
        ended: "Chamada encerrada",
      }[call.status] ?? "Desconectado")
    : ({
        connected: "Conectado",
        connecting: "Conectando…",
        reconnecting: "Reconectando…",
        error: "Falha na conexão",
        disconnected: "Desconectado",
      }[voice.connectionState] ?? "Desconectado");
  const controls = target ? (
    <>
      <span className="session-call-audio">
        <AudioInputControl
          boxed
          muted={current.muted}
          off={current.muted || (ptt && !voice.pttActive)}
          active={ptt && !current.muted && voice.pttActive}
          label={
            ptt
              ? `Push to talk — segure ${keyLabel(settings.pttKey)}`
              : current.muted
                ? "Ativar microfone"
                : "Silenciar microfone"
          }
          onToggle={current.toggleMute}
        />
      </span>
      <span className="session-call-audio">
        <AudioOutputControl
          boxed
          deafened={voice.deafened}
          onToggle={() => {
            // Preserve deafen's existing microphone-mute behavior for the selected private call too.
            if (privateSelected && !voice.deafened && !call.muted) call.toggleMute();
            voice.toggleDeafen();
          }}
        />
      </span>
      {supportsCamera() && (!privateSelected ? voice.cameraPermission !== "unavailable" : true) && (
        <DockButton
          label={current.cameraOn ? "Desligar câmera" : "Ligar câmera"}
          active={current.cameraOn}
          disabled={!ready}
          onClick={() => void current.toggleCamera()}
        >
          <VoiceIcon kind="camera" className="h-5 w-5" />
        </DockButton>
      )}
      {supportsScreenShare() && (
        <DockButton
          label={current.screenOn ? "Configurar transmissão" : "Compartilhar tela"}
          active={current.screenOn || (remoteSharing && !paused)}
          disabled={!ready}
          onClick={() => openScreenSharePanel(privateSelected ? "call" : "voice")}
        >
          <VoiceIcon kind="screen" className="h-5 w-5" />
        </DockButton>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="session-call-button" aria-label="Opções da chamada">
            <SlidersHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end">
          <DropdownMenuLabel>Opções da chamada</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => void navigate({ to: "/settings/voice" })}>
            Voz e áudio
          </DropdownMenuItem>
          {supportsScreenShare() && (
            <DropdownMenuItem
              disabled={!ready}
              onSelect={() => openScreenSharePanel(privateSelected ? "call" : "voice")}
            >
              Configurações de transmissão
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="session-call-noise">
        <NoiseSuppressionToggle />
      </span>
      {current.screenOn && (
        <DockButton
          text
          danger
          label="Parar transmissão"
          onClick={() => void current.toggleScreenShare()}
        >
          <Square className="h-4 w-4" />
        </DockButton>
      )}
      {remoteSharing && (
        <DockButton
          text={!paused}
          danger={!paused}
          active={paused}
          label={paused ? "Voltar à transmissão" : "Sair da transmissão"}
          onClick={() => setPaused(!paused)}
        >
          <LogOut className="h-4 w-4" />
        </DockButton>
      )}
      <DockButton
        danger
        disconnect
        tooltip="Desconectar da chamada"
        label={
          privateSelected
            ? call.status === "outgoing"
              ? "Cancelar chamada"
              : "Encerrar chamada"
            : "Desconectar da voz"
        }
        onClick={() => {
          if (privateSelected) call.hangUp();
          else void voice.leave();
        }}
      >
        <VoiceIcon kind="disconnect" className="h-6 w-6" />
      </DockButton>
    </>
  ) : undefined;
  return (
    <CallDockView
      profile={<UserBar expanded embedded hideAudio={!!target} />}
      info={
        target
          ? {
              name: privateSelected
                ? (call.peer?.display_name ?? "Chamada privada")
                : (channel?.name ?? "Canal de voz"),
              context: privateSelected
                ? call.groupConversationId
                  ? "Chamada em grupo"
                  : "Chamada privada"
                : (server?.name ?? "Carregando servidor…"),
              state,
              ready,
              transmitting: current.screenOn,
              watching: remoteSharing && !paused,
              paused: remoteSharing && paused,
              participants: uniqueDockParticipants(privateSelected ? privatePeople : voicePeople),
              onReturn: () => void returnToCall(),
            }
          : null
      }
      controls={controls}
      sessions={
        voice.activeChannelId && activePrivateCall(call.status) ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="session-call-count" aria-label="Selecionar chamada">
                2 chamadas
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top">
              <DropdownMenuItem onSelect={() => setPreferred("voice")}>
                {channel?.name ?? "Canal de voz"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPreferred("call")}>
                {call.peer?.display_name ?? "Chamada privada"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : undefined
      }
    />
  );
}
