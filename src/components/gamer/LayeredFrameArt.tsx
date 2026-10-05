import type { AnimeFrameId } from "@/lib/anime-frame-themes";

// Filled, multi-layer artwork sits around the card, leaving its content untouched.
// Static gradients provide volume without animated filters or raster/video assets.
export function LayeredFrameArt({
  theme,
  paint,
  highlight,
}: {
  theme: AnimeFrameId;
  paint: string;
  highlight: string;
}) {
  const fluid =
    theme === "crimson-flow" ||
    theme === "spirit-flame" ||
    theme === "celestial-energy" ||
    theme === "crimson-moon";
  const shadow = theme === "shadow-rise" || theme === "crimson-moon";
  return (
    <g className="lx-frame-art lx-fx">
      {fluid && (
        <>
          {[
            "",
            "translate(300 400) rotate(180)",
            "translate(300 0) scale(-1 1)",
            "translate(0 400) scale(1 -1)",
          ].map((transform, index) => (
            <g key={index} transform={transform} opacity={index < 2 ? 1 : 0.8}>
              <path
                fill={paint}
                d="M-12 130C-36 76-9 29 30 2C67-21 122-6 166-18C119 9 92-2 56 18C24 39 1 78-12 130Z"
              />
              <path
                fill={paint}
                d="M-22 97C-18 33 17 3 67-8L44 13C21 19 2 43-5 65L3 37C-14 59-6 72-22 97Z"
              />
              <path
                fill={highlight}
                d="M-18 107C-10 57 17 26 75 4C112-6 138-13 164-11C100 15 67 8 32 34C7 55-3 87-18 107Z"
              />
              <path
                fill="#fff7e8"
                opacity=".94"
                d="M-5 73C11 20 52 10 102 7C57 22 37 17 14 44L26 22C10 39 6 48-5 73Z"
              />
              <path fill={paint} d="M-10 150C16 119 10 89 23 65C14 112 28 135 7 174L17 141Z" />
              <path fill={highlight} d="M-7 158C8 136 13 122 10 106C23 140 5 164-7 177Z" />
              <path
                fill={paint}
                d="M-20 30l-6-15 11-9-3 13 8 9ZM66-18l9-12 14-3-11 11ZM-17 179l-7-9 6-15 4 14Z"
              />
            </g>
          ))}
          {theme === "crimson-flow" && (
            <g fill="none" stroke="#e0faff" strokeWidth="2.5">
              <path d="M-15 82C-28 66-3 55 3 38S34 7 54 7M-9 105C-16 87 12 77 14 53M315 318C328 334 303 345 297 362S266 393 246 393" />
              <path stroke="#ff244a" strokeWidth="4" d="M-15 52L55-10M245 410L315 348M80 2L160-5" />
            </g>
          )}
        </>
      )}
      {shadow && (
        <>
          {["", "translate(300 0) scale(-1 1)"].map((transform, index) => (
            <g key={index} transform={transform}>
              <path
                fill={paint}
                d="M3 398L-24 351-10 364-21 296-8 320-16 244-3 268-14 180 4 223 13 298 4 288 23 349 12 337 36 391Z"
              />
              <path fill={highlight} d="M4 398L-8 353 3 371-7 309 8 347 4 332 20 378Z" />
              <path fill={paint} d="M-4 128L-13 96-3 108-9 46 19 5 68-12 50 9 92 2 30 20 5 58Z" />
              <path fill={highlight} d="M2 73L5 42 29 11 55 5 23 24Z" />
              <path
                fill={paint}
                d="M-22 227L-28 211-16 193-19 215ZM-16 151L-21 140-10 128-13 140Z"
              />
            </g>
          ))}
          <path
            fill={paint}
            d="M17 392L54 384 43 394 97 390 81 399 152 396 219 399 202 389 257 394 246 384 283 392 269 408H31Z"
          />
          {theme === "crimson-moon" && (
            <g fill={highlight}>
              <path d="M52-10A21 21 0 1 0 14 27A29 29 0 0 1 52-10ZM248 410A21 21 0 1 0 286 373A29 29 0 0 1 248 410Z" />
            </g>
          )}
        </>
      )}
      {theme === "void-eye" && (
        <>
          {["", "translate(300 400) rotate(180)"].map((transform, index) => (
            <g key={index} transform={transform}>
              <path
                fill={paint}
                d="M-13 90C-30 54-12 6 33-10C68-23 110-6 146-13C96 15 59-2 34 14C8 30-1 53-13 90Z"
              />
              <path
                fill={highlight}
                d="M-12 60C-24 19 10-15 39-11C1 6-4 30 13 38C28 48 55 24 46 9C80 23 34 65 8 47C-7 38-11 22-1 7C-14 26-12 44-12 60Z"
              />
              <path fill={paint} d="M-10 128L6 80 15 60 5 119ZM112-8l32-7-12 14-28 9Z" />
            </g>
          ))}
        </>
      )}
      {theme === "thunderstorm" && (
        <>
          {["", "translate(300 400) rotate(180)"].map((transform, index) => (
            <g key={index} transform={transform}>
              <path
                fill={paint}
                d="M-7 154L-24 93-8 104-18 53 9 63 2 18 59-9 37 10 111-13 77 7 145 3 109 15 38 24 21 51 32 82 8 75 21 124-1 116Z"
              />
              <path
                fill={highlight}
                d="M-9 108L-16 76 1 89-4 51 13 62 9 30 52 8 29 30 20 44 26 73 8 64 14 109Z"
              />
              <path fill="#fffde8" d="M-8 75L-12 55 2 66 1 43 12 52 12 34 20 29 18 62 6 56 9 86Z" />
              <path fill={paint} d="M-23 184l-2-20 13 9-4-25 15 41-16-10Z" />
            </g>
          ))}
        </>
      )}
      {theme === "neon-impact" && (
        <>
          {["", "translate(300 400) rotate(180)"].map((transform, index) => (
            <g key={index} transform={transform}>
              <path
                fill={paint}
                d="M-17 105V34L14-14H105L82-4H23L-6 41V84ZM-8 139V83H4V65H16V118H5V157Z"
              />
              <path fill={highlight} d="M-10 59V37L17-7H64L47 1H24L1 42V59ZM64-12H119L108-5H60Z" />
              <path fill={paint} d="M-24 66h9v28h-9ZM-20 119h7v19h-7ZM131-14h30l-9 8h-28Z" />
              <path stroke="#d9ffff" strokeWidth="2" d="M-10 105V34L18-7H77" />
            </g>
          ))}
        </>
      )}
    </g>
  );
}
