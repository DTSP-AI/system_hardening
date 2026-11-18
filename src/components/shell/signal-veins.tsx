// Animated light nodes travelling along the real circuit-trace lines in the
// Signal theme's hero photo (public/backgrounds/signal-hero.webp). Paths were
// measured directly from the source image's pixel data (background-subtract +
// connected-component detection + per-column mean-y), not hand-drawn -- an
// eyeballed first pass didn't line up with the actual traces.
const VEIN_PATHS = [
  "M488,434 L644,424 L652,416 L660,408 L848,402 L856,394 L864,386 L872,378 L880,370 L888,364 L1076,372 L1084,380 L1092,388 L1100,394 L1264,400 L1272,408 L1280,416 L1444,416",
  "M492,522 L880,528 L888,536 L896,544 L904,552 L912,560 L1076,566 L1084,574 L1088,580 L1096,586 L1100,592 L1108,598 L1396,598",
  "M468,370 L580,364 L588,356 L596,348 L604,340 L796,334 L804,326 L808,320 L816,312 L824,304 L832,296 L844,290 L1144,284 L1152,276 L1160,268 L1168,260 L1176,252 L1340,246 L1352,248",
  "M492,494 L732,488 L740,480 L748,472 L940,480 L948,488 L956,496 L964,504 L972,510 L1368,512",
  "M480,588 L664,596 L672,604 L680,612 L688,618 L812,624 L820,632 L828,640 L836,648 L844,656 L852,664 L860,672 L868,678 L972,684 L980,692 L988,700 L996,708 L1004,716 L1012,724 L1184,732 L1192,740 L1200,748 L1208,756 L1216,764 L1336,764",
  "M488,554 L724,560 L732,568 L740,576 L848,584 L856,592 L864,600 L872,608 L880,616 L888,622 L1020,628 L1028,636 L1036,644 L1044,652 L1052,658 L1324,658",
  "M480,398 L620,392 L628,384 L636,376 L820,370 L828,362 L832,356 L840,350 L844,344 L852,338 L860,330 L1220,326",
  "M408,272 L416,280 L424,288 L428,294 L432,300 L436,306 L440,314 L448,326 L452,334 L560,326 L568,320 L576,312 L584,304 L788,296 L796,288 L804,280 L812,272 L820,264 L828,256 L836,248 L1116,248",
  "M472,618 L580,626 L588,634 L596,640 L600,646 L608,654 L740,660 L748,668 L756,676 L764,684 L772,692 L780,700 L788,708 L796,716 L804,724 L812,732 L936,740 L944,748 L952,756 L960,764 L968,772 L1124,776",
] as const;

const DURATIONS = [3.7, 4.2, 3.9, 4.5, 4.1, 3.8, 4.8, 4.0, 4.3];
const BEGINS = [0, 1.4, 2.8, 0.6, 3.5, 2.1, 0.9, 4.0, 1.9];

export function SignalVeins() {
  return (
    <svg
      className="signal-veins"
      viewBox="0 0 1536 1024"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <filter id="signal-vein-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {VEIN_PATHS.map((d, i) => (
        <circle
          key={d}
          r={i % 3 === 0 ? 4 : 3}
          fill={i % 4 === 1 ? "#93c5fd" : "#38bdf8"}
          filter="url(#signal-vein-glow)"
          opacity="0"
        >
          <animateMotion
            path={d}
            dur={`${DURATIONS[i]}s`}
            begin={`${BEGINS[i]}s`}
            repeatCount="indefinite"
            rotate="auto"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.08;0.88;1"
            dur={`${DURATIONS[i]}s`}
            begin={`${BEGINS[i]}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}
