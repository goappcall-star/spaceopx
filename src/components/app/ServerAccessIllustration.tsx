import { useId } from "react";

/** Static vector artwork: no animation or runtime image dependency. */
export function ServerAccessIllustration() {
  const id = useId().replace(/:/g, "");
  const ref = (name: string) => `url(#${id}-${name})`;
  return (
    <svg viewBox="0 0 230 215" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-ambient`}>
          <stop stopColor="#7340e7" stopOpacity=".27" />
          <stop offset="1" stopColor="#7340e7" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={`${id}-face`}
          x1="70"
          y1="60"
          x2="150"
          y2="164"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#17172c" />
          <stop offset=".55" stopColor="#0d1020" />
          <stop offset="1" stopColor="#080c16" />
        </linearGradient>
        <linearGradient
          id={`${id}-rim`}
          x1="70"
          y1="53"
          x2="156"
          y2="166"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#b7a5f1" />
          <stop offset=".45" stopColor="#615097" />
          <stop offset="1" stopColor="#9763ff" />
        </linearGradient>
        <linearGradient id={`${id}-badge`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#22203e" />
          <stop offset="1" stopColor="#0c101b" />
        </linearGradient>
        <linearGradient id={`${id}-lime`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d0ff7d" />
          <stop offset="1" stopColor="#9be638" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`${id}-soft`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <ellipse cx="116" cy="113" rx="114" ry="102" fill={ref("ambient")} />
      <path
        d="M64 49C-10 68 3 101 86 115M146 103c82 12 93 45 20 65"
        stroke="#b28afa"
        strokeWidth=".85"
        opacity=".8"
      />
      <path
        d="M44 108C-6 87 7 65 65 49M162 166c-19 10-38 15-66 20"
        stroke="#7a51c6"
        strokeWidth=".6"
        opacity=".5"
      />
      <ellipse
        cx="122"
        cy="153"
        rx="51"
        ry="16"
        transform="rotate(-18 122 153)"
        fill="#7c40fa"
        opacity=".58"
        filter={ref("glow")}
      />
      <g transform="rotate(-18 113 111)">
        <rect
          x="65"
          y="64"
          width="101"
          height="105"
          rx="24"
          fill="#362060"
          stroke="#673ac0"
          strokeWidth="1.2"
        />
        <rect
          x="61"
          y="57"
          width="102"
          height="106"
          rx="24"
          stroke="#9155f9"
          strokeWidth="4"
          opacity=".46"
          filter={ref("soft")}
        />
        <rect
          x="61"
          y="57"
          width="102"
          height="106"
          rx="24"
          fill={ref("face")}
          stroke={ref("rim")}
          strokeWidth="1.3"
        />
        <path
          d="M68 139v-58c0-9 7-17 16-18h47"
          stroke="#dad0ff"
          strokeOpacity=".13"
          strokeLinecap="round"
        />
        <g fill="#777d9b">
          <ellipse cx="109" cy="94" rx="6.4" ry="7.2" />
          <ellipse cx="94" cy="98" rx="4.9" ry="5.7" opacity=".78" />
          <ellipse cx="123" cy="98" rx="4.9" ry="5.7" opacity=".78" />
          <path d="M98 117v-4c0-7 4-11 11-11s11 4 11 11v4H98Z" />
          <path
            d="M86 116v-3c0-6 3-9 9-9l3 1c-3 3-4 7-4 11h-8Zm38 0c0-5-1-8-4-11l3-1c6 0 9 3 9 9v3h-8Z"
            opacity=".78"
          />
        </g>
        <circle cx="139" cy="136" r="14" fill="#a7f846" opacity=".38" filter={ref("soft")} />
        <circle cx="139" cy="134" r="12.5" fill={ref("lime")} stroke="#d1ff9b" strokeOpacity=".6" />
        <path d="M139 129v10m-5-5h10" stroke="#172111" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g transform="translate(31 150) rotate(-13)">
        <circle r="21" fill={ref("badge")} stroke="#5c5971" strokeOpacity=".7" />
        <circle r="18" stroke="#b5f14d" strokeOpacity=".06" />
        <path d="m-10-5 6 4 4-9 4 9 6-4-3 13H-7l-3-13Zm3 16H7" fill="#b1ed54" />
        <path d="M-7 11H7" stroke="#b1ed54" strokeWidth="2" />
      </g>
      <g transform="translate(182 48) rotate(14)">
        <circle r="21" fill={ref("badge")} stroke="#696096" strokeOpacity=".65" />
        <path
          d="M-6-6h12c4 0 7 12 5 14-2 2-5-2-7-4h-8c-2 2-5 6-7 4-2-2 1-14 5-14Z"
          fill="#a264fa"
        />
        <path d="M-5-3v6m-3-3h6" stroke="#35204e" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="5" cy="-1" r="1.2" fill="#35204e" />
        <circle cx="8" cy="2" r="1.2" fill="#35204e" />
      </g>
      <g transform="translate(169 184)">
        <circle r="21" fill={ref("badge")} stroke="#696096" strokeOpacity=".7" />
        <path
          d="m0-10 3 7 6 3-6 3-3 7-3-7-6-3 6-3 3-7Z"
          stroke="#a273ff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </g>
      <g>
        <circle cx="77" cy="46" r="5" fill="#282044" stroke="#65508f" strokeOpacity=".6" />
        <circle cx="77" cy="46" r="2" fill="#8a5fd1" />
        <circle cx="209" cy="91" r="5" fill="#1b2822" stroke="#697451" strokeOpacity=".65" />
        <circle cx="209" cy="91" r="2.2" fill="#bef467" />
        <circle cx="101" cy="198" r="5" fill="#1b2822" stroke="#697451" strokeOpacity=".5" />
        <circle cx="101" cy="198" r="2" fill="#bef467" />
      </g>
    </svg>
  );
}
