import type { CSSProperties } from "react";
import { ANIME_FRAME_THEMES, type AnimeFrameId } from "@/lib/anime-frame-themes";
import { useFrameVisibility } from "@/hooks/use-frame-visibility";
import "./anime-frames.css";

const rectangle = "M22 8H278Q292 8 292 22V378Q292 392 278 392H22Q8 392 8 378V22Q8 8 22 8Z";
const ellipse = "M150 8A142 192 0 1 1 149.99 8Z";

export function AnimeFrame({
  theme,
  animated = true,
  avatar = false,
}: {
  theme: AnimeFrameId;
  animated?: boolean;
  avatar?: boolean;
}) {
  const item = ANIME_FRAME_THEMES.find((value) => value.id === theme)!;
  const { ref, visible } = useFrameVisibility(animated && !avatar);
  const perimeter = avatar ? ellipse : rectangle;
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      fill="none"
      data-theme={theme}
      data-animated={animated}
      data-visible={avatar || visible}
      className={`lx-anime-frame pointer-events-none absolute inset-0 z-10 h-full w-full ${avatar ? "lx-frame-avatar" : ""}`}
      style={{ "--frame-color": item.color, "--frame-secondary": item.secondary } as CSSProperties}
    >
      <path d={perimeter} stroke={item.color} opacity=".35" strokeWidth="1.5" />
      {theme === "crimson-flow" && (
        <>
          <path
            className="lx-wave lx-fx"
            d={perimeter}
            stroke={item.color}
            strokeWidth="3"
            strokeDasharray="70 24 10 60"
          />
          <path
            d={
              avatar
                ? perimeter
                : "M8 95C28 65-2 48 14 27S58 26 84 8M216 392C245 376 266 398 280 376S272 335 292 307"
            }
            stroke="#e0f2fe"
            strokeWidth="2"
            strokeDasharray="20 8"
          />
          <path
            className="lx-cut lx-fx"
            d={avatar ? perimeter : "M5 62L70 5M230 395L295 333"}
            stroke={item.secondary}
            strokeWidth="2"
            strokeDasharray="32 80"
          />
        </>
      )}
      {(theme === "shadow-rise" || theme === "crimson-moon") && (
        <>
          <path
            className="lx-mist lx-fx"
            d={
              avatar
                ? perimeter
                : "M4 390C40 350-4 321 12 280S30 220 8 170M296 390C260 350 304 321 288 280S270 220 292 170"
            }
            stroke={item.secondary}
            strokeWidth="8"
            opacity=".3"
          />
          <path
            d={avatar ? perimeter : "M4 393L18 367L9 376L22 344M296 393L282 367L291 376L278 344"}
            stroke={item.color}
            strokeWidth="3"
          />
          {theme === "crimson-moon" && (
            <g className="lx-moon lx-fx" stroke={item.color} strokeWidth="2">
              <path d="M40 6A12 12 0 0 0 18 23M260 394A12 12 0 0 0 282 377" />
            </g>
          )}
          <Particles color={item.color} />
        </>
      )}
      {theme === "celestial-energy" && (
        <>
          <path
            className="lx-aura lx-fx"
            d={perimeter}
            stroke={item.color}
            strokeWidth="5"
            strokeDasharray="50 8 20 5"
          />
          <path
            className="lx-energy lx-fx"
            d={perimeter}
            stroke={item.secondary}
            strokeWidth="2"
            strokeDasharray="12 52"
          />
          <g className="lx-spark lx-fx" stroke="#fef9c3" strokeWidth="2">
            <path d="M5 80l12-7-3 12 10-5M295 320l-12 7 3-12-10 5" />
          </g>
        </>
      )}
      {theme === "void-eye" && (
        <>
          <path
            className="lx-orbit lx-fx"
            d={perimeter}
            stroke={item.secondary}
            strokeWidth="2"
            strokeDasharray="10 34"
          />
          {[24, 276].map((x, index) => (
            <g key={x} transform={`translate(${x} ${index ? 376 : 24})`}>
              <circle
                className="lx-void lx-fx"
                r="15"
                stroke={item.color}
                strokeWidth="2"
                strokeDasharray="18 6"
              />
              <circle r="7" stroke={item.secondary} />
            </g>
          ))}
        </>
      )}
      {theme === "thunderstorm" && (
        <>
          <path
            className="lx-bolt lx-fx"
            d={
              avatar
                ? perimeter
                : "M10 22L18 60 6 85 19 106 7 140 16 170M95 7L125 15 139 4 169 17 192 6"
            }
            stroke={item.color}
            strokeWidth="2"
          />
          <path
            className="lx-bolt lx-bolt-alt lx-fx"
            d={
              avatar
                ? perimeter
                : "M290 230L282 260 294 285 281 306 293 340 284 370M100 392L135 384 153 397 180 382 213 394"
            }
            stroke={item.secondary}
            strokeWidth="2"
          />
        </>
      )}
      {theme === "neon-impact" && (
        <>
          <path
            className="lx-speed lx-fx"
            d={perimeter}
            stroke={item.color}
            strokeWidth="3"
            strokeDasharray="35 100 8 50"
          />
          <path
            className="lx-glitch lx-fx"
            d={avatar ? perimeter : "M8 44H20V56H4M280 8V20H294M292 350H280V366H297M90 392V384H125"}
            stroke={item.secondary}
            strokeWidth="3"
          />
          <path d={perimeter} stroke={item.color} strokeDasharray="3 37" opacity=".65" />
        </>
      )}
      {theme === "spirit-flame" && (
        <>
          <path d={perimeter} stroke={item.secondary} strokeWidth="2" strokeDasharray="8 18" />
          {[8, 292].map((x) => (
            <g key={x} transform={`translate(${x} 270) scale(${x === 8 ? 0.45 : -0.45} 1)`}>
              <path
                className="lx-flame lx-fx"
                d="M0 30C-12 17-4 2 0-18C2-5 12 8 5 20C16 12 10-2 8-12C28 9 16 35 0 30Z"
                fill={item.color}
                opacity=".7"
              />
            </g>
          ))}
          <Particles color={item.secondary} />
        </>
      )}
    </svg>
  );
}

function Particles({ color }: { color: string }) {
  return (
    <g fill={color}>
      {[0, 1, 2, 3].map((index) => (
        <circle
          key={index}
          className="lx-rise lx-fx"
          cx={index % 2 ? 288 : 12}
          cy={120 + index * 70}
          r={index % 2 ? 2 : 1.5}
          style={{ animationDelay: `${index * -0.9}s` }}
        />
      ))}
    </g>
  );
}
