import { Phone, PhoneOff, Video } from "lucide-react";
import { useEffect, useRef } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCall } from "@/hooks/use-call";

/** Simple synthesized ringtone — avoids shipping an audio asset. */
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      const Ctor = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor();
      ctxRef.current = ctx;
      const beep = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.75);
      };
      beep();
      timer = setInterval(beep, 2400);
    } catch {
      /* audio unavailable — silent ring */
    }
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      void ctxRef.current?.close().catch(() => undefined);
      ctxRef.current = null;
    };
  }, [active]);
}

export function IncomingCallDialog() {
  const { status, peer, video, accept, decline } = useCall();
  const open = status === "incoming";
  useRingtone(open);

  if (!open || !peer) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
      <div className="border-border bg-overlay/95 glow-soft animate-in slide-in-from-top-4 flex w-full max-w-md items-center gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl">
        <span className="relative">
          <span className="bg-primary/30 absolute inset-0 animate-ping rounded-full" />
          <Avatar className="ring-primary/60 relative h-12 w-12 ring-2">
            <AvatarImage src={peer.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-surface-elevated">
              {peer.display_name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{peer.display_name}</p>
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            {video ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
            Chamada de {video ? "vídeo" : "voz"} recebida
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="icon" variant="destructive" onClick={decline} aria-label="Recusar">
            <PhoneOff className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="bg-emerald-500 text-white hover:bg-emerald-400"
            onClick={() => void accept()}
            aria-label="Atender"
          >
            <Phone className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
