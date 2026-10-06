import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import type { VoiceParticipant } from "@/types";
import { requestVoiceMove } from "@/services/voice-moderation";

const MIME = "application/x-lobbyx-voice-member";
export function useVoiceMemberDrag(
  serverId: string | undefined,
  allowed: boolean,
  rooms: Record<string, VoiceParticipant[]>,
) {
  const [target, setTarget] = useState<string | null>(null);
  const until = useRef(0);
  const busy = useRef(false);
  const source = (userId: string) => {
    const room = Object.entries(rooms).find(([, people]) =>
      people.some((p) => p.user_id === userId && p.voice_session_id),
    );
    const session = room?.[1].find((p) => p.user_id === userId)?.voice_session_id;
    return {
      draggable: Boolean(allowed && serverId && room && session),
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (!allowed || !room || !session) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        until.current = Infinity;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          MIME,
          JSON.stringify({ serverId, userId, channelId: room[0], session }),
        );
      },
      onDragEnd: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation();
        until.current = Date.now() + 350;
        setTarget(null);
      },
    };
  };
  const accepts = (event: DragEvent<HTMLElement>) =>
    allowed && !busy.current && event.dataTransfer.types.includes(MIME);
  const zone = (channelId: string) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setTarget(channelId);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(null);
      let data: { serverId: string; userId: string; channelId: string; session: string };
      try {
        data = JSON.parse(event.dataTransfer.getData(MIME));
      } catch {
        return;
      }
      if (
        data.serverId !== serverId ||
        data.channelId === channelId ||
        !rooms[data.channelId]?.some(
          (p) => p.user_id === data.userId && p.voice_session_id === data.session,
        )
      )
        return;
      busy.current = true;
      void requestVoiceMove(data.userId, data.channelId, channelId, data.session)
        .then(() => toast.success("Movimentação solicitada."))
        .catch(() =>
          toast.error(
            "Não foi possível mover. Confira a permissão de administrador e o canal de destino.",
          ),
        )
        .finally(() => {
          busy.current = false;
        });
    },
  });
  return { source, zone, target, suppressClick: () => Date.now() < until.current };
}
