import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import type { VoiceParticipant } from "@/types";
import {
  requestVoiceMove,
  voiceMemberLocation,
  CHANNEL_VOICE_SESSION,
} from "@/services/voice-moderation";

const MIME = "application/x-lobbyx-voice-member";
export function useVoiceMemberDrag(
  serverId: string | undefined,
  allowed: boolean,
  rooms: Record<string, VoiceParticipant[]>,
  channelIds?: string[],
) {
  const [dragging, setDragging] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const until = useRef(0);
  const busy = useRef(false);
  const source = (userId: string) => {
    const location = voiceMemberLocation(rooms, userId, channelIds);
    const room = location?.channelId;
    const session = location?.session;
    return {
      draggable: Boolean(allowed && serverId && room && session),
      style: allowed && room ? { userSelect: "none" as const } : undefined,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        if (!allowed || !room || !session) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
        until.current = Infinity;
        setDragging(true);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(
          MIME,
          JSON.stringify({ serverId, userId, channelId: room, session }),
        );
      },
      onDragEnd: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation();
        until.current = Date.now() + 350;
        setTarget(null);
        setDragging(false);
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
          (p) =>
            p.user_id === data.userId &&
            (data.session === CHANNEL_VOICE_SESSION || p.voice_session_id === data.session),
        )
      )
        return;
      busy.current = true;
      void requestVoiceMove(data.userId, data.channelId, channelId, data.session)
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
  return { source, zone, target, dragging, suppressClick: () => Date.now() < until.current };
}
