import { HeadphoneOff, MicOff, PhoneOff, Volume2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useVoice } from "@/hooks/use-voice";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Channel, MemberWithProfile } from "@/types";

interface Props {
  channel: Channel;
  members: MemberWithProfile[];
  me: MemberWithProfile | undefined;
  userId: string | undefined;
}

export function VoiceRoom({ channel, members, me, userId }: Props) {
  const { participantsByChannel, activeChannelId, connectionState, join, leave, volumes, setUserVolume } =
    useVoice();
  const participants = participantsByChannel[channel.id] ?? [];
  const inThisRoom = activeChannelId === channel.id;
  const canConnect = hasPermission(me, "connect");

  return (
    <div className="bg-hero-glow flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto p-8">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">🔊 {channel.name}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {participants.length === 0
            ? "Ninguém conectado ainda."
            : `${participants.length} conectado(s)`}
        </p>
      </div>

      <ul className="flex max-w-3xl flex-wrap justify-center gap-4">
        {participants.map((participant) => {
          const member = members.find((m) => m.user_id === participant.user_id);
          const name = member?.nickname ?? member?.profile?.display_name ?? "Usuário";
          const isSelf = participant.user_id === userId;
          const volume = volumes[participant.user_id] ?? 100;
          return (
            <li
              key={participant.user_id}
              className={cn(
                "border-border bg-surface flex w-44 flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                participant.speaking && "border-success shadow-glow",
              )}
            >
              <Avatar
                className={cn(
                  "h-16 w-16 ring-2 transition-all",
                  participant.speaking ? "ring-success" : "ring-border",
                )}
              >
                <AvatarImage src={member?.profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="bg-secondary">
                  {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="w-full truncate text-center text-sm font-medium">{name}</p>
              <div className="text-muted-foreground flex items-center gap-2">
                {participant.muted && <MicOff className="text-destructive h-4 w-4" />}
                {participant.deafened && <HeadphoneOff className="text-destructive h-4 w-4" />}
                {!participant.muted && !participant.deafened && (
                  <span className="text-[11px]">{participant.speaking ? "Falando" : "Silencioso"}</span>
                )}
              </div>
              {!isSelf && (
                <div className="flex w-full items-center gap-2">
                  <Volume2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                  <Slider
                    value={[volume]}
                    min={0}
                    max={200}
                    step={5}
                    aria-label={`Volume de ${name}`}
                    onValueChange={([next]) => setUserVolume(participant.user_id, next ?? 100)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {inThisRoom ? (
        <Button variant="destructive" onClick={() => void leave()}>
          <PhoneOff className="mr-2 h-4 w-4" />
          Sair do canal de voz
        </Button>
      ) : (
        <Button
          disabled={!canConnect || connectionState === "connecting"}
          onClick={() => void join(channel.id)}
        >
          {canConnect ? "Entrar no canal de voz" : "Sem permissão para conectar"}
        </Button>
      )}

      <p className="text-muted-foreground max-w-md text-center text-xs">
        Áudio local com detecção de fala e presença em tempo real. A transmissão P2P/SFU (WebRTC)
        conecta-se a esta mesma camada quando a infraestrutura de voz for ativada.
      </p>
    </div>
  );
}
