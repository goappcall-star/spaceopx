import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

interface Props {
  stream: MediaStream | null;
  muted?: boolean | undefined;
  mirrored?: boolean | undefined;
  className?: string | undefined;
  objectFit?: "cover" | "contain" | undefined;
}

/** Thin <video> wrapper that binds a MediaStream imperatively (never via src). */
export function VideoSurface({
  stream,
  muted = true,
  mirrored = false,
  className,
  objectFit = "cover",
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={cn(
        "h-full w-full",
        objectFit === "cover" ? "object-cover" : "object-contain",
        mirrored && "scale-x-[-1]",
        className,
      )}
    />
  );
}
