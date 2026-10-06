import { useEffect, useRef } from "react";
export const AFK_TIMEOUT_MS = 10 * 60 * 1000;

export function useVoiceAfk({
  muted,
  roomId,
  afkId,
  join,
}: {
  muted: boolean;
  roomId: string | null;
  afkId: string | null;
  join: (id: string) => Promise<void>;
}) {
  const mutedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!muted || !roomId) {
      mutedAt.current = null;
      return;
    }
    mutedAt.current ??= Date.now();
    if (!afkId || roomId === afkId) return;
    const timer = setTimeout(
      () => {
        void join(afkId).catch(() => undefined);
      },
      Math.max(0, AFK_TIMEOUT_MS - (Date.now() - mutedAt.current)),
    );
    return () => clearTimeout(timer);
  }, [muted, roomId, afkId, join]);
}
