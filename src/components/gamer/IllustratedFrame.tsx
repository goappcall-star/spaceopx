import { useId } from "react";
import { useFrameVisibility } from "@/hooks/use-frame-visibility";
import { FRAME_PALETTES, type IllustratedFrameId } from "@/lib/illustrated-frames";
import "./illustrated-frames.css";
// Preserve the illustration's proportions; the rounded safe mask clears the content.
function FrameArt({ src }: { src: string }) {
  return <image href={src} x="-18" y="-20" width="336" height="440" preserveAspectRatio="none" />;
}
const contour = "M150 5H257Q295 5 295 43V357Q295 395 257 395H43Q5 395 5 357V43Q5 5 43 5H150Z";
export function IllustratedFrame({
  theme,
  animated = true,
  avatar = false,
  compact = false,
}: {
  theme: IllustratedFrameId;
  animated?: boolean;
  avatar?: boolean;
  compact?: boolean;
}) {
  const { ref, visible } = useFrameVisibility(animated);
  const id = useId().replaceAll(":", "");
  const [color, secondary] = FRAME_PALETTES[theme];
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      data-theme={theme}
      data-visible={visible}
      data-animated={animated}
      className={
        "lx-illustrated-frame pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible" +
        (avatar ? " lx-illustrated-avatar" : "")
      }
    >
      <defs>
        <mask id={id + "-safe"} maskUnits="userSpaceOnUse" x="-35" y="-35" width="370" height="470">
          <rect x="-35" y="-35" width="370" height="470" rx="64" fill="white" />
          {avatar ? (
            <ellipse cx="150" cy="200" rx="128" ry="174" fill="black" />
          ) : (
            <rect x="16" y="16" width="268" height="368" rx="32" fill="black" />
          )}
        </mask>
        <linearGradient id={id + "-energy"}>
          <stop stopColor={color} stopOpacity="0" />
          <stop offset=".5" stopColor={secondary} />
          <stop offset="1" stopColor={color} />
        </linearGradient>
        <mask
          id={id + "-metal"}
          maskUnits="userSpaceOnUse"
          x="-18"
          y="-20"
          width="336"
          height="440"
          style={{ maskType: "alpha" }}
        >
          <FrameArt
            src={"/frames/illustrated/" + theme + (compact || avatar ? "-compact.webp" : ".webp")}
          />
        </mask>
      </defs>
      <g mask={"url(#" + id + "-safe)"}>
        <FrameArt
          src={"/frames/illustrated/" + theme + (compact || avatar ? "-compact.webp" : ".webp")}
        />
        {theme === "royal" && (
          <g mask={"url(#" + id + "-metal)"}>
            <path
              className="lx-metal-reflection"
              d={contour}
              pathLength="1000"
              stroke="#fff1bf"
              strokeWidth="30"
              strokeDasharray="48 952"
              fill="none"
              opacity=".48"
            />
          </g>
        )}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {Array.from({ length: 3 }, (_, i) => (
            <path
              key={i}
              className="lx-frame-trail"
              d={contour}
              pathLength="1000"
              stroke={i === 1 ? secondary : color}
              strokeWidth={theme === "royal" ? 1.5 : 3 - i * 0.7}
              strokeDasharray={theme === "royal" ? "35 965" : "140 860"}
              style={{ animationDelay: i * -1.1 + "s" }}
            />
          ))}
          {(theme === "shadow-rise" || theme === "crimson-moon") &&
            [0, 1].map((i) => (
              <path
                key={i}
                className="lx-shadow-stream"
                d={
                  i
                    ? "M292 395C318 340 280 315 300 270S277 190 299 140S278 55 298 0"
                    : "M4 395C-16 340 25 300 0 250S25 180 0 120S21 50 0 0"
                }
                stroke={"url(#" + id + "-energy)"}
                strokeWidth="9"
                opacity=".65"
                style={{ animationDelay: i * -2 + "s" }}
              />
            ))}
          {theme === "aurora" &&
            [0, 1, 2].map((i) => (
              <path
                key={i}
                className="lx-aurora-wave"
                d={contour}
                pathLength="1000"
                stroke={i % 2 ? color : secondary}
                strokeDasharray="75 35 180 710"
                strokeWidth={5 - i}
                style={{ animationDelay: i * -2 + "s" }}
              />
            ))}
          {theme === "celestial-energy" &&
            [0, 1].map((i) => (
              <path
                key={i}
                className="lx-celestial-rise"
                d={
                  i
                    ? "M290 375C300 350 278 330 302 305L288 281 307 250 285 219 305 183 286 146 304 111 290 60"
                    : "M10 375C0 350 22 330 -2 305L12 281 -7 250 15 219 -5 183 14 146 -4 111 10 60"
                }
                stroke={secondary}
                strokeWidth="2.2"
                style={{ animationDelay: i * -1.7 + "s" }}
              />
            ))}
          {theme === "thunderstorm" &&
            [0, 1, 2, 3].map((i) => (
              <g key={i} className="lx-thunder-sequence" style={{ animationDelay: i * -1.3 + "s" }}>
                <path
                  d={
                    [
                      "M0 35L38 -12 29 9 84 2 57 21 109 3",
                      "M290 43L317 89 293 83 300 155 278 137 299 188",
                      "M288 376L248 410 258 383 201 397 224 371 172 391",
                      "M9 333L-16 275 8 293 -6 224 19 248 1 190",
                    ][i]
                  }
                  stroke={secondary}
                  strokeWidth="3"
                />
                <path
                  d={
                    [
                      "M29 9L45 38 38 12",
                      "M300 155L275 162 297 177",
                      "M258 383L244 358 252 380",
                      "M8 293L31 279 12 308",
                    ][i]
                  }
                  stroke={color}
                  strokeWidth="2"
                />
              </g>
            ))}
        </g>
        {theme === "void-eye" &&
          [
            [12, 18],
            [288, 382],
          ].map(([x, y], i) => (
            <g key={i} transform={"translate(" + x + " " + y + ")"}>
              <g className="lx-vortex-turn" style={{ animationDelay: i * -2 + "s" }}>
                <ellipse rx="18" ry="12" fill="#100821" stroke={color} strokeWidth="3" />
                <path
                  d="M-17 2C-23-10 0-23 17-7S14 21-6 17"
                  fill="none"
                  stroke={secondary}
                  strokeWidth="2"
                />
                <ellipse
                  rx="23"
                  ry="16"
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="40 30"
                />
              </g>
            </g>
          ))}
        {theme === "crimson-moon" &&
          [
            [9, 8],
            [284, 379],
          ].map(([x, y], i) => (
            <g key={i} transform={"translate(" + x + " " + y + ")"}>
              <path
                className="lx-moon-breathe"
                d="M10-19A22 22 0 1 0 10 19C-15 15-15-15 10-19"
                fill="#8d091d"
                stroke="#ff3b4d"
                strokeWidth="2"
                style={{ animationDelay: i * -2 + "s" }}
              />
            </g>
          ))}
        {theme === "cosmic" &&
          [0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i} transform={"translate(" + (i % 2 ? 293 : 7) + " " + (35 + i * 61) + ")"}>
              <path
                className="lx-star-twinkle"
                d="M0-7L2-2 7 0 2 2 0 7-2 2-7 0-2-2Z"
                fill="#ffe3ac"
                style={{ animationDelay: i * -0.8 + "s" }}
              />
            </g>
          ))}
        {(theme === "shadow-rise" || theme === "cosmic") &&
          [0, 1, 2, 3].map((i) => (
            <circle
              key={i}
              className="lx-border-mote"
              cx={i % 2 ? 292 : 8}
              cy={100 + i * 70}
              r="1.5"
              fill={secondary}
              style={{ animationDelay: i * -1.3 + "s" }}
            />
          ))}
        {theme === "sakura" &&
          [0, 1, 2, 3].map((i) => (
            <g key={i} transform={"translate(" + (i % 2 ? 291 : 9) + " " + (18 + i * 120) + ")"}>
              <g className="lx-blossom-sway" style={{ animationDelay: i * -1.5 + "s" }}>
                {[0, 72, 144, 216, 288].map((angle) => (
                  <ellipse
                    key={angle}
                    cy="-5"
                    rx="3.5"
                    ry="6"
                    transform={"rotate(" + angle + ")"}
                    fill="#ffc0df"
                  />
                ))}
                <circle r="2" fill="#ffda92" />
              </g>
            </g>
          ))}
        {theme === "sakura" &&
          [0, 1, 2].map((i) => (
            <path
              key={i}
              className="lx-petal-follow"
              d="M4 0C12-9 17-2 10 5C7 8 3 7 4 0"
              fill="#ffc0df"
              style={{
                offsetPath:
                  'path("M8 30C-6 120 22 190 8 285Q5 390 100 395H270Q296 390 292 310V40")',
                animationDelay: i * -3 + "s",
              }}
            />
          ))}
      </g>
    </svg>
  );
}
