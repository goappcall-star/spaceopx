import { memo, useEffect, useId, useRef } from "react";
import { useFrameVisibility } from "@/hooks/use-frame-visibility";

// The supplied illustration is retained verbatim. Masks expose only its flame perimeter.
const route =
  "M257 169 H843 Q961 169 961 287 V1137 Q961 1255 843 1255 H257 Q139 1255 139 1137 V287 Q139 169 257 169Z";
const layers = [
  { fill: "#ff2339", width: 18, opacity: 0.75 },
  { fill: "#ff852f", width: 12, opacity: 0.95 },
  { fill: "#ffeb8c", width: 7, opacity: 1 },
  { fill: "#fffde5", width: 2.6, opacity: 1 },
];
const trails = [
  { lag: 0, span: 0.18 },
  { lag: 0.35, span: 0.14 },
  { lag: 0.69, span: 0.11 },
];

// One bounded 30 fps clock, regardless of how many profile overlays are mounted.
let sharedPoints: { x: number; y: number; nx: number; ny: number }[] | undefined;
const draws = new Set<(time: number) => void>();
let clock = 0;
let previous = 0;
let elapsed = 1000;
let geometryTime = -1;
let geometry: string[] = [];
function tick(now: number) {
  if (!previous || now - previous >= 1000 / 30) {
    elapsed += previous ? Math.min(now - previous, 65) : 0;
    previous = now;
    for (const draw of draws) draw(elapsed);
  }
  clock = draws.size ? requestAnimationFrame(tick) : 0;
}
function subscribe(draw: (time: number) => void) {
  draws.add(draw);
  if (!clock) clock = requestAnimationFrame(tick);
  return () => {
    draws.delete(draw);
    if (!draws.size) {
      cancelAnimationFrame(clock);
      clock = 0;
      previous = 0;
    }
  };
}

export const FlamingCutFrame = memo(function FlamingCutFrame({
  animated = true,
}: {
  animated?: boolean;
}) {
  const { ref, visible } = useFrameVisibility(animated);
  const routeRef = useRef<SVGPathElement>(null);
  const ribbons = useRef<(SVGPathElement | null)[]>([]);
  const id = `flame-${useId().replaceAll(":", "")}`;
  useEffect(() => {
    const scene = ref.current;
    const path = routeRef.current;
    if (!scene || !path) return;
    const length = path.getTotalLength();
    const count = 2400;
    const points = (sharedPoints ??= Array.from({ length: count }, (_, i) => {
      const p = path.getPointAtLength((i / count) * length);
      const q = path.getPointAtLength(((i / count) * length + 1) % length);
      const dx = q.x - p.x,
        dy = q.y - p.y,
        m = Math.hypot(dx, dy) || 1;
      return { x: p.x, y: p.y, nx: dy / m, ny: -dx / m };
    }));
    function sample(v: number) {
      const f = (((v % 1) + 1) % 1) * count,
        i = Math.floor(f),
        t = f - i;
      const a = points[i]!,
        b = points[(i + 1) % count]!;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        nx: a.nx + (b.nx - a.nx) * t,
        ny: a.ny + (b.ny - a.ny) * t,
      };
    }
    function ribbon(head: number, span: number, width: number, phase: number) {
      const a: string[] = [],
        b: string[] = [];
      for (let i = 0; i <= 80; i++) {
        const u = i / 80,
          p = sample(head - span + u * span);
        const taper = Math.pow(Math.sin(Math.PI * u), 0.8) * (0.45 + u * 0.85);
        const tongue = Math.pow(Math.max(0, Math.sin(u * 45 + phase)), 6) * 9;
        const wiggle = Math.sin(u * 24 + phase) * 3 * taper;
        const w = (width + (tongue * width) / 18) * taper;
        a.push(
          `${(p.x + p.nx * (w + wiggle)).toFixed(1)},${(p.y + p.ny * (w + wiggle)).toFixed(1)}`,
        );
        b.push(
          `${(p.x + p.nx * (-w * 0.4 + wiggle)).toFixed(1)},${(p.y + p.ny * (-w * 0.4 + wiggle)).toFixed(1)}`,
        );
      }
      return "M" + a.join("L") + "L" + b.reverse().join("L") + "Z";
    }
    function draw(time: number) {
      // Same artwork, geometry and phase for all overlays: build twelve ribbons
      // once per shared tick, then reuse the immutable strings for visible cards.
      if (geometryTime !== time) {
        geometry = trails.flatMap((trail) =>
          layers.map((layer) =>
            ribbon(time / 3200 - trail.lag, trail.span, layer.width, time / 600 + trail.lag * 7),
          ),
        );
        geometryTime = time;
      }
      trails.forEach((trail, t) =>
        layers.forEach((layer, l) => {
          ribbons.current[t * layers.length + l]?.setAttribute(
            "d",
            geometry[t * layers.length + l]!,
          );
        }),
      );
    }
    draw(elapsed);
    let stop: (() => void) | undefined;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    function update() {
      const root = document.documentElement;
      const run =
        animated &&
        visible &&
        !document.hidden &&
        root.dataset["visualQuality"] !== "optimized" &&
        root.dataset["visualQuality"] !== "maximum" &&
        !motion.matches &&
        root.dataset["frameAnimations"] !== "false" &&
        root.dataset["animations"] !== "false";
      stop?.();
      stop = undefined;
      if (run) {
        scene!.unpauseAnimations();
        stop = subscribe(draw);
      } else scene!.pauseAnimations();
    }
    const preferences = new MutationObserver(update);
    preferences.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-frame-animations", "data-animations", "data-visual-quality"],
    });
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    update();
    return () => {
      stop?.();
      preferences.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", update);
      scene.pauseAnimations();
    };
  }, [animated, visible, ref]);
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="139 169 822 1086"
      preserveAspectRatio="none"
      className="lx-flaming-cut pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
    >
      <defs>
        <image id={`${id}-art`} href="/frames/flaming-cut-source.png" width="1111" height="1416" />
        {/* Chroma-based mask removes the mockup background while keeping the supplied flame art. */}
        <filter id={`${id}-chroma`}>
          <feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 5 -1.5 -3.5 0 -0.35" />
          <feMorphology operator="dilate" radius="2" />
          <feGaussianBlur stdDeviation="1" />
        </filter>
        <mask
          id={`${id}-color`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="1111"
          height="1416"
          style={{ maskType: "alpha" }}
        >
          <use href={`#${id}-art`} filter={`url(#${id}-chroma)`} />
        </mask>
        <mask id={`${id}-band`} maskUnits="userSpaceOnUse" x="0" y="0" width="1111" height="1416">
          <rect width="1111" height="1416" fill="black" />
          <path d={route} fill="none" stroke="white" strokeWidth="175" />
          <rect x="190" y="220" width="740" height="980" rx="100" fill="black" />
        </mask>
        <filter
          id={`${id}-flow`}
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".008 .021"
            numOctaves="2"
            seed="12"
            result="noise"
          >
            <animate
              attributeName="baseFrequency"
              values=".008 .021;.012 .018;.008 .021"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="15"
            xChannelSelector="R"
            yChannelSelector="G"
          >
            <animate
              attributeName="scale"
              values="12;23;15;12"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </feDisplacementMap>
        </filter>
        <filter id={`${id}-shine`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <path ref={routeRef} id={`${id}-route`} d={route} />
      </defs>
      <g mask={`url(#${id}-band)`}>
        <g mask={`url(#${id}-color)`}>
          <use href={`#${id}-art`} />
          <g filter={`url(#${id}-flow)`}>
            <use href={`#${id}-art`} />
          </g>
        </g>
      </g>
      <g filter={`url(#${id}-shine)`}>
        {trails.flatMap((_, t) =>
          layers.map((layer, l) => (
            <path
              key={`${t}-${l}`}
              ref={(node) => {
                ribbons.current[t * layers.length + l] = node;
              }}
              fill={layer.fill}
              opacity={layer.opacity}
            />
          )),
        )}
      </g>
    </svg>
  );
});
