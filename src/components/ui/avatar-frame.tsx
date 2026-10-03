import { normalizeAvatarFrame } from "@/lib/avatar-frames";

/** Vector decorations stay crisp at every avatar size and never cover the face. */
export function AvatarFrame({ frame }: { frame?: string | null | undefined }) {
  const id = normalizeAvatarFrame(frame);
  if (id === "default") return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 128 128"
      fill="none"
      className="pointer-events-none absolute -inset-[12%] z-[1] h-[124%] w-[124%] overflow-visible"
    >
      {id === "neon" && (
        <>
          <circle cx="64" cy="64" r="53" stroke="#13191c" strokeWidth="7" />
          <circle
            cx="64"
            cy="64"
            r="53"
            stroke="#c4ff3d"
            strokeWidth="3"
            strokeDasharray="116 50"
            transform="rotate(-72 64 64)"
          />
          <circle
            cx="64"
            cy="64"
            r="57"
            stroke="#a76bff"
            strokeWidth="2"
            strokeDasharray="28 151"
            transform="rotate(-34 64 64)"
          />
          <path
            d="m12 30 9-4-3 10M107 94l9 4-7 8"
            fill="#a76bff"
            stroke="#c4ff3d"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m54 115 7 6 5-5 7 4" stroke="#c4ff3d" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {id === "orbit" && (
        <>
          <circle cx="64" cy="64" r="53" stroke="#112635" strokeWidth="7" />
          <circle cx="64" cy="64" r="53" stroke="#67e8f9" strokeWidth="2.5" />
          <circle
            cx="64"
            cy="64"
            r="59"
            stroke="#818cf8"
            strokeWidth="1.5"
            strokeDasharray="88 33 20 44"
            transform="rotate(24 64 64)"
          />
          <path d="m105 15 2 7 7 2-7 2-2 7-2-7-7-2 7-2Z" fill="#b6f7ff" />
          <circle cx="16" cy="97" r="5" fill="#67e8f9" stroke="#142438" strokeWidth="2" />
          <circle cx="79" cy="121" r="2.5" fill="#c7d2fe" />
        </>
      )}
      {id === "royal" && (
        <>
          <circle cx="64" cy="64" r="53" stroke="#362b22" strokeWidth="7" />
          <circle cx="64" cy="64" r="53" stroke="#f5ce79" strokeWidth="2.5" />
          <path d="M19 85q8 23 29 30M109 85q-8 23-29 30" stroke="#dba64d" strokeWidth="2" />
          <path
            d="m24 97-10-5 4 11 10 1m4 4-10 0 8 8 10-3m64-16 10-5-4 11-10 1m-4 4 10 0-8 8-10-3"
            fill="#dba64d"
          />
          <path
            d="m48 15-3-12 12 6 7-8 7 8 12-6-3 12Z"
            fill="#f5ce79"
            stroke="#362b22"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m64 112 5 5-5 6-5-6Z" fill="#f5ce79" />
        </>
      )}
    </svg>
  );
}
