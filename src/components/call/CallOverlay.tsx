import { Mic, MicOff, MonitorUp, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { VideoTile, type TileData } from "@/components/voice/VideoTile";
import { NoiseSuppressionToggle } from "@/components/voice/NoiseSuppressionToggle";
import { useAuth } from "@/hooks/use-auth";
import { useAudioSettings } from "@/hooks/use-audio-settings";
import { useCall } from "@/hooks/use-call";
import { cn } from "@/lib/utils";
import { conversationsService } from "@/services/social";
import { toast } from "sonner";
import { SharedScreen } from "./SharedScreen";

function useElapsed(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Plays the peer's microphone audio, independently of the local mic state. */
function CallAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const { settings } = useAudioSettings();
  const [blocked, setBlocked] = useState(false);

  const attemptPlay = useCallback(async () => {
    const el = ref.current;
    if (!el || !el.srcObject) return;
    try {
      await el.play();
      setBlocked(false);
    } catch (error) {
      // Autoplay policy — surface it instead of silently losing remote voice.
      if ((error as DOMException)?.name === "NotAllowedError") setBlocked(true);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.muted = false;
    if (stream) void attemptPlay();
  }, [stream, attemptPlay]);

  useEffect(() => {
    const el = ref.current as
      (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!el) return;
    const volume = Number.isFinite(settings.outputVolume) ? settings.outputVolume : 100;
    el.volume = Math.max(0, Math.min(1, volume / 100));
    if (settings.outputDeviceId && typeof el.setSinkId === "function")
      void el.setSinkId(settings.outputDeviceId).catch(() => undefined);
  }, [settings.outputVolume, settings.outputDeviceId, stream]);

  return (
    <>
      <audio ref={ref} autoPlay playsInline className="hidden" />
      {blocked && (
        <div className="flex justify-center pt-3">
          <Button size="sm" variant="outline" onClick={() => void attemptPlay()}>
            Ativar áudio da chamada
          </Button>
        </div>
      )}
    </>
  );
}

export function CallAudioPlayback() {
  const call = useCall();
  return (
    <>
      <CallAudio stream={call.remote?.audio ?? null} />
      {Object.entries(call.groupMedia).map(([id, media]) => (
        <CallAudio key={id} stream={media.audio} />
      ))}
    </>
  );
}

export function CallOverlay({ showPanel = true }: { showPanel?: boolean }) {
  const { profile } = useAuth();
  const call = useCall();
  const { status, endReason, peer, muted, cameraOn, screenOn, localCamera, localScreen, remote } =
    call;

  const visible = status !== "idle";
  const connected = status === "active" || status === "reconnecting" || status === "waiting";
  const [remaining, setRemaining] = useState(30);
  useEffect(() => {
    if (call.aloneDeadline === null) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((call.aloneDeadline! - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [call.aloneDeadline]);
  const elapsed = useElapsed(connected);

  const tiles = useMemo<TileData[]>(() => {
    if (!peer || !profile) return [];
    if (call.groupConversationId)
      return call.participants.map((participant) => ({
        userId: participant.id,
        name: participant.display_name,
        avatarUrl: participant.avatar_url,
        avatarFrame: participant.avatar_frame,
        stream:
          participant.id === profile.id
            ? localCamera
            : (call.groupMedia[participant.id]?.camera ?? null),
        kind: "camera",
        isSelf: participant.id === profile.id,
        speaking: false,
        muted: participant.id === profile.id && muted,
        screenSharing: false,
      }));
    const list: TileData[] = [
      {
        userId: peer.id,
        name: peer.display_name,
        avatarUrl: peer.avatar_url,
        avatarFrame: peer.avatar_frame,
        stream: remote?.camera ?? null,
        kind: "camera",
        isSelf: false,
        speaking: false,
        muted: false,
        screenSharing: !!remote?.screen,
      },
      {
        userId: profile.id,
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
        avatarFrame: profile.avatar_frame,
        stream: localCamera,
        kind: "camera",
        isSelf: true,
        speaking: false,
        muted,
        screenSharing: screenOn,
      },
    ];
    return status === "waiting" ? list.filter((tile) => tile.isSelf) : list;
  }, [
    status,
    peer,
    profile,
    remote,
    localCamera,
    muted,
    screenOn,
    call.groupConversationId,
    call.participants,
    call.groupMedia,
  ]);

  const screenTile = useMemo<TileData | null>(() => {
    const sharing = call.participants.find(
      (participant) => call.groupMedia[participant.id]?.screen,
    );
    if (sharing)
      return {
        userId: sharing.id,
        name: sharing.display_name,
        avatarUrl: sharing.avatar_url,
        avatarFrame: sharing.avatar_frame,
        stream: call.groupMedia[sharing.id]!.screen,
        kind: "screen",
        isSelf: false,
        speaking: false,
        muted: false,
        screenSharing: true,
      };
    if (remote?.screen && peer)
      return {
        userId: peer.id,
        name: peer.display_name,
        avatarUrl: peer.avatar_url,
        avatarFrame: peer.avatar_frame,
        stream: remote.screen,
        kind: "screen",
        isSelf: false,
        speaking: false,
        muted: false,
        screenSharing: true,
      };
    if (localScreen && profile)
      return {
        userId: profile.id,
        name: profile.display_name,
        avatarUrl: profile.avatar_url,
        avatarFrame: profile.avatar_frame,
        stream: localScreen,
        kind: "screen",
        isSelf: true,
        speaking: false,
        muted,
        screenSharing: true,
      };
    return null;
  }, [remote, localScreen, peer, profile, muted, call.participants, call.groupMedia]);

  useEffect(() => {
    if (status !== "ended") return;
    const id = setTimeout(call.dismiss, 2500);
    return () => clearTimeout(id);
  }, [status, call]);

  if (!visible || !peer || status === "incoming") return null;

  const label =
    status === "waiting"
      ? `Você está sozinho · encerrando em ${remaining}s`
      : status === "outgoing"
        ? "Chamando..."
        : status === "connecting"
          ? "Conectando..."
          : status === "reconnecting"
            ? "Reconectando..."
            : status === "ended"
              ? endReason === "declined"
                ? "Chamada recusada"
                : endReason === "busy"
                  ? "Usuário ocupado"
                  : endReason === "unanswered"
                    ? "Sem resposta"
                    : endReason === "failed"
                      ? "Falha na chamada"
                      : "Chamada encerrada"
              : elapsed;

  return (
    <>
      {showPanel && (
        <section
          aria-label="Chamada em andamento"
          className={cn(
            "bg-surface border-border flex shrink-0 flex-col overflow-y-auto border-b",
            screenTile ? "max-h-[70vh]" : "max-h-[45vh]",
          )}
        >
          <header className="flex h-12 shrink-0 items-center gap-3 px-5">
            <Avatar frame={peer.avatar_frame} className="ring-border h-9 w-9 ring-1">
              <AvatarImage src={peer.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-surface-elevated text-xs">
                {peer.display_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{peer.display_name}</p>
              <p
                className={cn(
                  "text-xs",
                  connected ? "text-primary font-mono" : "text-muted-foreground",
                )}
              >
                {label}
              </p>
            </div>
          </header>

          <div className="min-h-0 px-5">
            {screenTile ? (
              <div className="flex min-w-0 flex-col gap-3 pt-2">
                <div className="mx-auto flex h-[clamp(200px,35vh,420px)] w-full max-w-4xl shrink-0">
                  <SharedScreen
                    key={screenTile.userId + "-" + screenTile.stream?.id}
                    tile={screenTile}
                  />
                </div>
                <div
                  aria-label="Participantes da chamada"
                  className="flex min-w-0 gap-2 overflow-x-auto py-1"
                >
                  <div className="mx-auto flex w-max items-center gap-2">
                    {tiles.map((tile) =>
                      tile.stream ? (
                        <VideoTile key={tile.userId} tile={tile} className="h-28 w-44 shrink-0" />
                      ) : (
                        <div
                          key={tile.userId}
                          className="border-border bg-surface-elevated flex w-44 shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5"
                        >
                          <Avatar frame={tile.avatarFrame} className="h-9 w-9 shrink-0">
                            <AvatarImage src={tile.avatarUrl ?? undefined} alt="" />
                            <AvatarFallback className="text-xs">
                              {tile.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium" title={tile.name}>
                              {tile.name}
                            </p>
                            <p className="text-muted-foreground text-[11px]">
                              {tile.isSelf ? "Você" : "Na chamada"}
                            </p>
                          </div>
                          {tile.muted && (
                            <MicOff
                              aria-label="Microfone silenciado"
                              className="text-muted-foreground h-3.5 w-3.5 shrink-0"
                            />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-center gap-5 overflow-x-auto py-3">
                {tiles.map((tile) =>
                  tile.stream ? (
                    <VideoTile key={tile.userId} tile={tile} className="h-32 w-48 shrink-0" />
                  ) : (
                    <div
                      key={tile.userId}
                      className="flex w-20 shrink-0 flex-col items-center gap-2"
                    >
                      <Avatar frame={tile.avatarFrame} className="ring-border h-16 w-16 ring-2">
                        <AvatarImage src={tile.avatarUrl ?? undefined} alt="" />
                        <AvatarFallback>{tile.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="max-w-full truncate text-xs">
                        {tile.name}
                        {tile.isSelf ? " (você)" : ""}
                      </span>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          <footer className="flex h-16 shrink-0 items-center justify-center gap-2">
            {status === "ended" ? (
              <Button variant="outline" onClick={call.dismiss}>
                Fechar
              </Button>
            ) : (
              <>
                <CallButton
                  label={muted ? "Ativar microfone" : "Silenciar microfone"}
                  active={muted}
                  danger={muted}
                  disabled={!connected}
                  onClick={call.toggleMute}
                >
                  {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </CallButton>

                <CallButton
                  label={cameraOn ? "Desligar câmera" : "Ligar câmera"}
                  active={cameraOn}
                  disabled={!connected}
                  onClick={() => void call.toggleCamera()}
                >
                  {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </CallButton>

                <CallButton
                  label={screenOn ? "Parar compartilhamento" : "Compartilhar tela"}
                  active={screenOn}
                  disabled={!connected}
                  onClick={() => void call.toggleScreenShare()}
                >
                  <MonitorUp className="h-5 w-5" />
                </CallButton>

                <NoiseSuppressionToggle />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-10 w-12 rounded-full"
                      onClick={call.hangUp}
                      aria-label="Encerrar chamada"
                    >
                      {status === "outgoing" ? (
                        <Phone className="h-5 w-5 rotate-[135deg]" />
                      ) : (
                        <PhoneOff className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Encerrar</TooltipContent>
                </Tooltip>
              </>
            )}
          </footer>
        </section>
      )}
    </>
  );
}

function CallButton({
  label,
  active,
  danger,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className={cn(
            "border-border bg-surface h-10 w-10 rounded-full border",
            active && !danger && "border-primary/60 text-primary glow-soft",
            danger && "border-destructive/60 text-destructive",
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function CallWorkspace({
  children,
  onOpenConversation,
  conversation,
}: {
  children: React.ReactNode;
  onOpenConversation: (id: string) => void;
  conversation: { id: string; type: string; other_user_id: string | null } | null;
}) {
  const call = useCall();
  const openRef = useRef(onOpenConversation);
  openRef.current = onOpenConversation;
  const engaged = ["outgoing", "connecting", "active", "reconnecting", "waiting"].includes(
    call.status,
  );
  const peerId = call.peer?.id;
  const groupId = call.groupConversationId;
  const showPanel =
    !!conversation &&
    (groupId
      ? conversation.id === groupId
      : conversation.type === "direct" && !!peerId && conversation.other_user_id === peerId);
  useEffect(() => {
    if (!engaged || !peerId) return;
    let cancelled = false;
    if (groupId) openRef.current(groupId);
    else
      void conversationsService
        .openDirect(peerId)
        .then((id) => {
          if (!cancelled) openRef.current(id);
        })
        .catch(() => toast.error("Não foi possível abrir a conversa da chamada."));
    return () => {
      cancelled = true;
    };
  }, [engaged, peerId, groupId]);
  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col">
        <CallOverlay showPanel={showPanel} />
        {children}
      </main>
      {showPanel && engaged && call.participants.length >= 3 && (
        <aside
          aria-label="Membros da chamada"
          className="bg-surface border-border w-40 shrink-0 overflow-y-auto border-l p-3 lg:w-56"
        >
          <h2 className="text-muted-foreground mb-4 text-xs font-semibold uppercase">
            Membros — {call.participants.length}
          </h2>
          <ul className="space-y-3">
            {call.participants.map((member) => (
              <li key={member.id} className="flex items-center gap-2">
                <Avatar frame={member.avatar_frame} className="h-8 w-8 shrink-0">
                  <AvatarImage src={member.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{member.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{member.display_name}</span>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </>
  );
}
