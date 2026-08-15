import { Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Signal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks/use-voice";
import { cn } from "@/lib/utils";

const STATE_LABEL: Record<string, string> = {
  connecting: "Conectando...",
  connected: "Voz conectada",
  reconnecting: "Reconectando...",
  error: "Falha na conexão",
  disconnected: "Desconectado",
};

export function VoiceBar({ channelName }: { channelName: string }) {
  const { connectionState, muted, deafened, toggleMute, toggleDeafen, leave } = useVoice();
  const connected = connectionState === "connected";

  return (
    <div className="border-border bg-surface/80 border-t px-3 py-2">
      <div className="flex items-center gap-2">
        <Signal
          className={cn("h-4 w-4 shrink-0", connected ? "text-success" : "text-warning animate-pulse")}
        />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-xs font-semibold", connected ? "text-success" : "text-warning")}>
            {STATE_LABEL[connectionState]}
          </p>
          <p className="text-muted-foreground truncate text-[11px]">🔊 {channelName}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive h-8 w-8"
          aria-label="Desconectar da voz"
          onClick={() => void leave()}
        >
          <PhoneOff className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={muted ? "destructive" : "secondary"}
          onClick={toggleMute}
          aria-pressed={muted}
        >
          {muted ? <MicOff className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />}
          {muted ? "Mudo" : "Microfone"}
        </Button>
        <Button
          size="sm"
          variant={deafened ? "destructive" : "secondary"}
          onClick={toggleDeafen}
          aria-pressed={deafened}
        >
          {deafened ? (
            <HeadphoneOff className="mr-1.5 h-4 w-4" />
          ) : (
            <Headphones className="mr-1.5 h-4 w-4" />
          )}
          {deafened ? "Silenciado" : "Áudio"}
        </Button>
      </div>
    </div>
  );
}
