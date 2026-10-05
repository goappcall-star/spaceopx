import { useId, type CSSProperties } from "react";
import { ANIME_FRAME_THEMES, type AnimeFrameId } from "@/lib/anime-frame-themes";
import { useFrameVisibility } from "@/hooks/use-frame-visibility";
import { ExistingFrameArtwork } from "./ExistingFrameArtwork";
import "./anime-frames.css";

// Clockwise: top -> right -> bottom -> left. pathLength normalizes every layer.
const contour = "M150 7H274Q293 7 293 26V374Q293 393 274 393H26Q7 393 7 374V26Q7 7 26 7H150Z";

export function AnimeFrame({
  theme,
  animated = true,
  avatar = false,
}: {
  theme: AnimeFrameId;
  animated?: boolean;
  avatar?: boolean;
}) {
  // Avatar artwork is deliberately preserved; this redesign only changes card overlays.
  return avatar ? (
    <ExistingFrameArtwork theme={theme} animated={animated} avatar />
  ) : theme === "crimson-flow" || theme === "crimson-moon" ? (
    <SwordCutFrame theme={theme} animated={animated} />
  ) : (
    <ExistingFrameArtwork theme={theme} animated={animated} />
  );
}

function SwordCutFrame({ theme, animated }: { theme: AnimeFrameId; animated: boolean }) {
  const { ref, visible } = useFrameVisibility(animated);
  const id = useId().replaceAll(":", "");
  const item = ANIME_FRAME_THEMES.find((entry) => entry.id === theme)!;
  const crimson = theme === "crimson-moon" || theme === "crimson-flow";
  const energy = crimson ? "#ff9d18" : item.color;
  const outer = crimson ? "#fa123e" : item.secondary;
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      fill="none"
      data-theme={theme}
      data-animated={animated}
      data-visible={visible}
      className="lx-anime-frame lx-sword-frame pointer-events-none absolute inset-0 z-10 h-full w-full"
    >
      <defs>
        <filter
          id={`${id}-glow`}
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
      </defs>
      {/* Two tapered arcs follow the same geometry, with the second 304 ms behind. */}
      {[
        { phase: 0, length: 270, opacity: 1 },
        { phase: 95, length: 175, opacity: 0.72 },
      ].map((arc, index) => (
        <g key={index} opacity={arc.opacity} data-cut-arc={index}>
          <Trail
            phase={arc.phase}
            length={arc.length + 32}
            width={2}
            color={outer}
            opacity={0.55}
          />
          <Trail
            phase={arc.phase}
            length={arc.length}
            width={17}
            color={outer}
            opacity={0.6}
            filter={`url(#${id}-glow)`}
          />
          <Trail
            phase={arc.phase}
            length={arc.length - 18}
            width={11}
            color={outer}
            opacity={0.85}
          />
          <Trail phase={arc.phase - 5} length={arc.length - 40} width={7} color={energy} />
          <Trail phase={arc.phase - 10} length={arc.length - 65} width={3.8} color="#ffe59a" />
          <Trail phase={arc.phase - 15} length={arc.length - 85} width={1.7} color="#fffdf0" />
          <Trail phase={arc.phase - 21} length={22} width={0.8} color="#ffffff" />
        </g>
      ))}
      {/* Sparse sparks remain attached to the cutting path; no independent orbit. */}
      <path
        d={contour}
        pathLength={1000}
        className="lx-sword-stroke lx-fx"
        stroke="#fff4c1"
        strokeWidth="1.4"
        strokeDasharray="2 12 3 17 2 964"
        style={{ "--cut-offset": "-30px" } as CSSProperties}
      />
    </svg>
  );
}

function Trail({
  phase,
  length,
  width,
  color,
  opacity = 1,
  filter,
}: {
  phase: number;
  length: number;
  width: number;
  color: string;
  opacity?: number;
  filter?: string;
}) {
  return (
    <path
      d={contour}
      pathLength={1000}
      className="lx-sword-stroke lx-fx"
      stroke={color}
      strokeWidth={width}
      opacity={opacity}
      strokeLinecap="butt"
      strokeLinejoin="round"
      filter={filter}
      strokeDasharray={`${length} ${1000 - length}`}
      style={{ "--cut-offset": `${phase + length}px` } as CSSProperties}
    />
  );
}
