import { useId, type SVGProps } from "react";

type VoiceIconKind =
  "mic" | "headphones" | "camera" | "screen" | "connection" | "disconnect" | "settings";

/** Compact, solid controls with the same silhouette in both call surfaces. */
export function VoiceIcon({
  kind,
  off = false,
  ...props
}: SVGProps<SVGSVGElement> & {
  kind: VoiceIconKind;
  off?: boolean;
}) {
  const cutoutId = `voice-icon-${useId().replaceAll(":", "")}`;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" {...props}>
      {off && (
        <defs>
          <mask id={cutoutId}>
            <rect width="24" height="24" fill="white" />
            <path d="m3 3 18 18" stroke="black" strokeWidth="6" />
          </mask>
        </defs>
      )}
      <g mask={off ? `url(#${cutoutId})` : undefined}>
        <g fill="currentColor">
          {kind === "mic" && <rect x="8" y="2" width="8" height="13" rx="4" />}
          {kind === "headphones" && (
            <>
              <rect x="3" y="11" width="5" height="10" rx="2.5" />
              <rect x="16" y="11" width="5" height="10" rx="2.5" />
            </>
          )}
          {kind === "camera" && (
            <>
              <rect x="2" y="5" width="14" height="14" rx="4" />
              <path d="m17 9 4-3q1-1 1 1v10q0 2-1 1l-4-3Z" />
            </>
          )}
          {kind === "screen" && (
            <>
              <path
                fillRule="evenodd"
                d="M5 3a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6v2H7v2h10v-2h-4v-2h6a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3Zm0 2h14a1 1 0 0 1 1 1v9H4V6a1 1 0 0 1 1-1Z"
              />
              <path d="m12 6-4 4h3v3h2v-3h3Z" />
            </>
          )}
          {kind === "connection" && <circle cx="4" cy="20" r="2" />}
          {kind === "disconnect" && (
            <path d="M2 10c5-6 15-6 20 0q1 1 0 2l-2 3q-1 1-2 0l-3-2v-3a13 13 0 0 0-6 0v3l-3 2q-1 1-2 0l-2-3q-1-1 0-2Z" />
          )}
          {kind === "settings" && (
            <path
              fillRule="evenodd"
              d="m10 2-.6 3-1.7 1-2.9-1-2 3.5L5 10v2l-2.2 1.5 2 3.5 2.9-1 1.7 1 .6 3h4l.6-3 1.7-1 2.9 1 2-3.5L19 12v-2l2.2-1.5-2-3.5-2.9 1-1.7-1-.6-3Zm2 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
            />
          )}
        </g>
        <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {kind === "mic" && <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8" />}
          {kind === "headphones" && <path d="M4 12v-2a8 8 0 0 1 16 0v2" />}
          {kind === "connection" && (
            <path d="M4 13a7 7 0 0 1 7 7M4 7a13 13 0 0 1 13 13M4 2a18 18 0 0 1 18 18" />
          )}
        </g>
      </g>
      {off && <path d="m3 3 18 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}
