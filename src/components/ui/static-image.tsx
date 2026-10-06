import { useEffect, useRef, useState, type ReactNode, type ImgHTMLAttributes } from "react";
import { useMediaAnimations } from "@/hooks/use-visual-quality";
export function isAnimatedImage(src?: string, type?: string) {
  return type === "image/gif" || /\.gif(?:[?#]|$)/i.test(src ?? "");
}
// Canvas displays a single decoded frame. No continuously decoding hidden image remains.
export function StaticImage({
  src,
  alt,
  className,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!src) return;
    const image = new Image();
    let active = true;
    image.onload = () => {
      if (!active || !canvas.current) return;
      const limit = Math.min(
        1024,
        Math.max(canvas.current.clientWidth, canvas.current.clientHeight, 32) *
          Math.min(window.devicePixelRatio || 1, 2),
      );
      const scale = Math.min(1, limit / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.current.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.current.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.current
        .getContext("2d")
        ?.drawImage(image, 0, 0, canvas.current.width, canvas.current.height);
      image.onload = null;
      image.onerror = null;
      image.src = "";
    };
    image.onerror = () => {
      if (active) setFailed(true);
    };
    image.src = src;
    return () => {
      active = false;
      image.onload = null;
      image.onerror = null;
      image.src = "";
    };
  }, [src]);
  return failed ? (
    <span className={className}>{alt || "Imagem indisponível"}</span>
  ) : (
    <canvas
      ref={canvas}
      role="img"
      aria-label={alt || "Imagem"}
      className={className}
      style={props.style}
    />
  );
}
export function VisualImage({
  animated,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { animated?: boolean }) {
  const animateMedia = useMediaAnimations();
  return !animateMedia && (animated || isAnimatedImage(props.src)) ? (
    <StaticImage {...props} />
  ) : (
    <img {...props} />
  );
}
export function VisualBanner({
  src,
  className,
  children,
}: {
  src: string | null;
  className: string;
  children?: ReactNode;
}) {
  const animateMedia = useMediaAnimations();
  return !animateMedia && isAnimatedImage(src ?? undefined) ? (
    <div className={className + " relative"}>
      <StaticImage
        src={src ?? undefined}
        alt="Banner"
        className="absolute inset-0 h-full w-full rounded-[inherit] object-cover"
      />
      {children}
    </div>
  ) : (
    <div className={className} style={src ? { backgroundImage: `url(${src})` } : undefined}>
      {children}
    </div>
  );
}
