export default function Sentry({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "sentry-icon" : "sentry-hero"}
      viewBox="0 0 400 400"
      fill="none"
      role="img"
      aria-label="防衛ロボット SENTINEL"
    >
      <defs>
        <linearGradient
          id="metal"
          x1="110"
          y1="80"
          x2="300"
          y2="310"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#d5e7df" />
          <stop offset=".45" stopColor="#607e77" />
          <stop offset="1" stopColor="#152d2c" />
        </linearGradient>
        <linearGradient id="visor" x1="130" y1="150" x2="260" y2="230">
          <stop stopColor="#172f31" />
          <stop offset="1" stopColor="#081819" />
        </linearGradient>
        <radialGradient id="aura">
          <stop stopColor="#b8f48a" stopOpacity=".2" />
          <stop offset="1" stopColor="#6bcdb8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="210" r="190" fill="url(#aura)" />
      <g className="sentry-orbit" stroke="#88b6a3" strokeOpacity=".25">
        <ellipse cx="200" cy="290" rx="155" ry="55" />
        <ellipse cx="200" cy="290" rx="120" ry="40" strokeDasharray="4 12" />
      </g>
      <g className="sentry-body">
        <path
          d="M150 270l-10 30 25 8 20-35M250 270l10 30-25 8-20-35"
          fill="url(#metal)"
          stroke="#77978c"
        />
        <path
          d="M128 145l-25 15v60l26 20M272 145l25 15v60l-26 20"
          fill="#284641"
          stroke="#78968b"
          strokeWidth="3"
        />
        <path
          d="M145 108l55-18 55 18 25 40-10 93-70 50-70-50-10-93z"
          fill="url(#metal)"
          stroke="#b5d2c1"
          strokeWidth="2"
        />
        <path
          d="M146 134l54-15 54 15 10 33-9 57-55 34-55-34-9-57z"
          fill="url(#visor)"
          stroke="#57766c"
          strokeWidth="3"
        />
        <path
          d="M154 171l29 7-3 18-24-4zM246 171l-29 7 3 18 24-4z"
          fill="#d0ff9f"
        />
        <path d="M185 218h30l-15 10z" fill="#9cc2af" />
        <path d="M192 81v23h16V81" fill="#b4c9be" />
        <circle cx="200" cy="76" r="7" fill="#c5fb95" />
        <path d="M190 269l10 9 10-9" stroke="#cdffac" strokeWidth="3" />
        <path
          d="M125 210l-34 15-17 48 42 36 35-29 4-47z"
          fill="#173d37"
          stroke="#a2c8a9"
          strokeWidth="2"
        />
        <path
          d="M120 230l-22 9-8 29 24 23 22-19 3-30z"
          fill="#84ba83"
          fillOpacity=".12"
          stroke="#c7fa96"
        />
        <path d="M110 251v21m-10-10h20" stroke="#c7fa96" strokeWidth="3" />
        <path
          d="M275 216l35 19-8 29-30 4"
          fill="url(#metal)"
          stroke="#9cbaae"
          strokeWidth="2"
        />
        <path d="M309 239l26-13 9 13-26 15" fill="#b0d8c5" />
        <circle cx="341" cy="232" r="5" fill="#c7fa96" />
        <path
          d="M150 114l14 8m86-8-14 8M136 237l12-7m116 7-12-7"
          stroke="#edf7ee"
          strokeOpacity=".5"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
