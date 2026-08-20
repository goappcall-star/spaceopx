import { MicOff, MonitorUp, VideoOff, Volume2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { VideoSurface } from "@/components/voice/VideoSurface";
import { cn } from "@/lib/utils";

export interface TileData {
  userId: string;
  name: string;
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

  return (
    <div
      className={cn(
        "border-border bg-surface group relative overflow-hidden rounded-xl border transition-all",
        tile.speaking && tile.kind === "camera" && "border-primary/70 glow-soft",
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
            className={cn(
              large ? "h-24 w-24" : "h-16 w-16",
              "ring-2 transition-all",
              tile.speaking ? "ring-primary" : "ring-border",
            )}
          >
            <AvatarImage src={tile.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="bg-secondary">
              {tile.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
            <VideoOff className="h-3 w-3" /> câmera desligada
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-2.5 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-white">
            {tile.name}
            {tile.isSelf && " (você)"}
            {tile.kind === "screen" && " · tela"}
          </p>
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
        <div className="pointer-events-auto absolute inset-x-2 top-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
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
