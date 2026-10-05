import { profileCosmetic } from "@/lib/profile-cosmetics";
import { isAnimeFrame } from "@/lib/anime-frame-themes";
import { AnimeFrame } from "./AnimeFrame";
import { FlamingCutFrame } from "./FlamingCutFrame";

/** Decorative overlay never intercepts profile or menu interactions. */
export function ProfileFrameDecoration({
  value,
  animated = true,
}: {
  value: unknown;
  animated?: boolean;
}) {
  const item = profileCosmetic(value);
  if (item.id === "none") return null;
  if (item.id === "flaming-cut") return <FlamingCutFrame animated={animated} />;
  if (isAnimeFrame(item.id)) return <AnimeFrame theme={item.id} animated={animated} />;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
      style={{ border: `2px solid ${item.color}80`, boxShadow: `inset 0 0 22px ${item.color}18` }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 300 400"
        fill="none"
      >
        <path
          d="M8 46V20Q8 8 20 8H70 M230 8H280Q292 8 292 20V46 M8 354V380Q8 392 20 392H70 M230 392H280Q292 392 292 380V354"
          stroke={item.color}
          strokeWidth="3"
        />
        <path
          d="M130 8L150 17L170 8 M130 392L150 383L170 392"
          stroke={item.secondary}
          strokeWidth="2"
        />
        {[30, 90, 210, 270].map((x) => (
          <path key={x} d={`M${x} 6l2 4-2 4-2-4z`} fill={item.secondary} />
        ))}
        {[25, 275].map((x) => (
          <g key={x} transform={`translate(${x}, 16)`}>
            {item.id === "sakura" ? (
              <g fill={item.color}>
                {[0, 72, 144, 216, 288].map((angle) => (
                  <ellipse key={angle} cy="-5" rx="3" ry="5" transform={`rotate(${angle})`} />
                ))}
                <circle r="2" fill={item.secondary} />
              </g>
            ) : item.id === "royal" ? (
              <path d="M-10-5l5 5 5-8 5 8 5-5-2 13H-8z" fill={item.color} />
            ) : item.id === "ember" ? (
              <path d="M0-10C-2-2-9 0-7 6C-5 13 6 13 7 6C9 0 3-4 4-8L0 1z" fill={item.color} />
            ) : (
              <path d="M0-10l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={item.secondary} />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
