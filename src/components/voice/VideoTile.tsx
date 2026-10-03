import { MicOff, MonitorUp, Volume2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { VideoSurface } from "@/components/voice/VideoSurface";
import { cn } from "@/lib/utils";

export interface TileData {
  userId: string;
  name: string;
  avatarFrame?: string | undefined;
  avatarUrl?: string | null;
  stream: MediaStream | null;
  kind: "camera" | "screen";
  isSelf: boolean;
  speaking: boolean;
  muted: boolean;
  screenSharing: boolean;
  gameLabel?: string | null;
}

interface Props {
  tile: TileData;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
  className?: string;
  large?: boolean;
}

export function VideoTile({ tile, volume, onVolumeChange, className, large }: Props) {
  const showVideo = !!tile.stream;
  const isSpeaking = tile.speaking && !tile.muted && tile.kind === "camera";

  return (
    <div
      className={cn(
        "border-transparent bg-surface group relative overflow-hidden rounded-xl border-2 transition-colors duration-150",
        isSpeaking && "border-green-500 shadow-[0_0_16px_rgba(34,197,94,0.18)]",
        className,
      )}
    >
      {showVideo ? (
        <VideoSurface
          stream={tile.stream}
          mirrored={tile.isSelf && tile.kind === "camera"}
          objectFit={tile.kind === "screen" ? "contain" : "cover"}
          className={tile.kind === "screen" ? "bg-black" : undefined}
        />
      ) : (
        <div className="bg-surface-elevated flex h-full w-full flex-col items-center justify-center gap-2 p-4">
          <Avatar
            frame={tile.avatarFrame}
            className={cn(
              large ? "h-24 w-24" : "h-20 w-20",
              "ring-2 ring-offset-4 ring-offset-surface-elevated transition-shadow duration-150",
              isSpeaking ? "ring-green-500" : "ring-transparent",
            )}
          >
            <AvatarImage src={tile.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-secondary">
              {tile.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2">
        <div className="min-w-0">
          <p className="max-w-full truncate rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
            {tile.name}
            {tile.isSelf && " (você)"}
            {tile.kind === "screen" && " · tela"}
          </p>
          {isSpeaking && <span className="sr-only">Falando</span>}
          {tile.gameLabel && (
            <p className="truncate text-[10px] text-white/70">🎮 {tile.gameLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {tile.screenSharing && tile.kind === "camera" && (
            <MonitorUp className="text-primary h-3.5 w-3.5" />
          )}
          {tile.muted && <MicOff className="text-destructive h-3.5 w-3.5" />}
        </div>
      </div>

      {!tile.isSelf && onVolumeChange && tile.kind === "camera" && (
        <div
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          className="pointer-events-auto absolute inset-x-2 top-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <Volume2 className="h-3.5 w-3.5 shrink-0 text-white/80" />
          <Slider
            value={[volume ?? 100]}
            min={0}
            max={200}
            step={5}
            aria-label={`Volume de ${tile.name}`}
            onValueChange={([next]) => onVolumeChange(next ?? 100)}
          />
        </div>
      )}
    </div>
  );
}
