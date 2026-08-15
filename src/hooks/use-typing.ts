import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

const TYPING_TTL = 4000;

/** Typing indicators are ephemeral broadcasts — nothing is persisted. */
export function useTyping(channelId: string | null, userId: string | undefined, name: string) {
  const [typing, setTyping] = useState<Record<string, { name: string; at: number }>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!channelId || !userId) return;

    const realtime = supabase.channel(`typing:${channelId}`, {
      config: { broadcast: { self: false } },
    });
    realtime
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const data = payload as { user_id: string; name: string };
        if (data.user_id === userId) return;
        setTyping((prev) => ({ ...prev, [data.user_id]: { name: data.name, at: Date.now() } }));
      })
      .subscribe();
    channelRef.current = realtime;

    const interval = window.setInterval(() => {
      setTyping((prev) => {
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, v]) => Date.now() - v.at < TYPING_TTL),
        );
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 1000);

    return () => {
      window.clearInterval(interval);
      channelRef.current = null;
      setTyping({});
      void supabase.removeChannel(realtime);
    };
  }, [channelId, userId]);

  const notifyTyping = useCallback(() => {
    if (!channelRef.current || !userId) return;
    const now = Date.now();
    if (now - lastSent.current < 1500) return;
    lastSent.current = now;
    void channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: userId, name },
    });
  }, [name, userId]);

  return { typingNames: Object.values(typing).map((t) => t.name), notifyTyping };
}
