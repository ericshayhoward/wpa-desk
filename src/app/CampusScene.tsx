import type { CSSProperties, KeyboardEvent } from "react";
import type { TermAnalysis } from "../model";
import type { TrainingSession } from "../training";
import {
  BUILDINGS,
  FOUNDERS_WINDOWS,
  buildingTrust,
  campusLife,
  foundersWindows,
  skyAt,
  trustBand,
  type BuildingId,
  type DayClock,
  type TrustBand,
  type WaitingItem,
  type WindowKind,
} from "./campusView";

/* Midland State's campus, drawn in the cast portraits' style: ink outlines and
   flat bright fills on a 360×210 canvas. Everything that moves or changes
   color is read from the session (see campus.ts); the rest is scenery.

   Layers, back to front: sky; the world (dimmed by a dusk filter as the
   day's admin hours run out); lights that switch on at dusk; inbox markers;
   and transparent hit areas that make each building a button.

   Anything animated by CSS sits in a <g> with no transform attribute,
   because a CSS transform replaces the attribute. The app's reduced-motion
   rule stops every animation, leaving each piece at its resting spot. */

const W = 360;
const H = 210;
const GROUND = 140;
const INK = "#1f1b2d";
const ink = { stroke: INK, strokeWidth: 1.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;
const thin = { ...ink, strokeWidth: 0.9 } as const;

const FLAG: Record<TrustBand, string> = { high: "#3fae6b", mid: "#f2b544", low: "#e2482f" };
const GLASS = "#cfe3ee";
const LAMP = "#ffd77a";

/** Deterministic scatter, so the scene looks the same on every render. */
function rand(i: number, k = 0): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type Vars = CSSProperties & Record<`--${string}`, string>;

interface Props {
  session: TrainingSession;
  analysis: TermAnalysis;
  clock: DayClock;
  waiting: Map<BuildingId, WaitingItem[]>;
  selected: BuildingId | null;
  onSelect: (id: BuildingId) => void;
  onHover: (id: BuildingId | null) => void;
}

export function CampusScene({ session, analysis, clock, waiting, selected, onSelect, onHover }: Props) {
  const sky = skyAt(clock.hour);
  const dark = sky.darkness;
  const life = campusLife(session, analysis, dark);
  const windows = foundersWindows(analysis);
  const ending = !!session.ending;
  // Out of admin hours and still working: everyone else has gone home.
  const workingLate = clock.overtime > 0 && session.adminHoursRemaining <= 0;
  const scheduled = session.pending.some((p) => p.announced);
  const flag = (id: BuildingId) => {
    const t = buildingTrust(session, id);
    return t === null ? null : FLAG[trustBand(t)];
  };

  return (
    <svg className="campus-scene" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Campus map">
      <defs>
        <linearGradient id="campus-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky.top} />
          <stop offset="0.6" stopColor={sky.mid} />
          <stop offset="1" stopColor={sky.horizon} />
        </linearGradient>
        <radialGradient id="campus-glow">
          <stop offset="0" stopColor={LAMP} stopOpacity="0.85" />
          <stop offset="1" stopColor={LAMP} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="campus-sun">
          <stop offset="0.45" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#ffd45c" stopOpacity="0" />
        </radialGradient>
        {dark > 0 && (
          <filter id="campus-dusk" colorInterpolationFilters="sRGB">
            <feComponentTransfer>
              <feFuncR type="linear" slope={1 - 0.62 * dark} />
              <feFuncG type="linear" slope={1 - 0.58 * dark} />
              <feFuncB type="linear" slope={1 - 0.36 * dark} />
            </feComponentTransfer>
          </filter>
        )}
      </defs>

      <g aria-hidden="true" pointerEvents="none">
        <rect width={W} height={GROUND + 10} fill="url(#campus-sky)" />
        <Stars opacity={dark} />
        <SunAndMoon hour={clock.hour} />
        <Clouds opacity={1 - 0.8 * dark} />

        <g filter={dark > 0 ? "url(#campus-dusk)" : undefined}>
          <Hills season={life.season} />
          <Library flag={flag("library")} />
          <OldMain flag={flag("old_main")} hour={clock.hour} />
          <Humanities flag={flag("humanities")} />
          <ArtsSciences flag={flag("arts_sciences")} />
          <Founders kinds={windows.kinds} />
          <Grounds />
          {[83, 139, 215, 268].map((x, i) => (
            <Tree key={x} x={x} y={GROUND + 11 + (i % 2) * 2} i={i} season={life.season} />
          ))}
          <Lamps />
          {scheduled && <ScheduleSign />}
          {Array.from({ length: life.stranded }, (_, i) => (
            <Person key={`s${i}`} x={293 + i * 9} y={160} i={i + 40} question={i === 0} />
          ))}
          <Walkers count={life.walkers} graduates={ending} />
          {life.leaving && <Leaving />}
          <BikeRack />
          <Tree x={22} y={192} i={5} season={life.season} big />
          <Tree x={252} y={193} i={6} season={life.season} big />
          <Road />
          <Bus />
        </g>

        <Lights dark={dark} hour={clock.hour} workingLate={workingLate} kinds={windows.kinds} />
        {ending && <Commencement />}
        <Falling season={life.season} dim={dark} />
        <Markers waiting={waiting} />
        <YouAreHere />
      </g>

      {BUILDINGS.map((b) => {
        const n = waiting.get(b.id)?.length ?? 0;
        const r = HIT[b.id];
        const choose = () => onSelect(b.id);
        return (
          <g
            key={b.id}
            className="cs-hit"
            role="button"
            tabIndex={0}
            aria-label={`${b.name}${n ? `, ${n} waiting` : ""}`}
            aria-pressed={selected === b.id}
            onClick={choose}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                choose();
              }
            }}
            onMouseEnter={() => onHover(b.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(b.id)}
            onBlur={() => onHover(null)}
          >
            <rect x={r[0]} y={r[1]} width={r[2]} height={r[3]} rx={8} />
          </g>
        );
      })}
    </svg>
  );
}

/** Each building's clickable area [x, y, width, height], covering its marker. */
const HIT: Record<BuildingId, [number, number, number, number]> = {
  library: [3, 62, 80, 80],
  old_main: [84, 16, 55, 126],
  humanities: [140, 50, 75, 92],
  arts_sciences: [216, 68, 52, 74],
  founders: [269, 62, 88, 80],
  quad: [2, 144, 356, 47],
};

/** Where each building's inbox marker floats. */
const MARKER: Record<BuildingId, [number, number]> = {
  library: [43, 72],
  old_main: [129, 80],
  humanities: [177, 59],
  arts_sciences: [240, 80],
  founders: [313, 74],
  quad: [44, 160],
};

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

function Stars({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <g fill="#fff" opacity={opacity}>
      {Array.from({ length: 22 }, (_, i) => (
        <circle key={i} className={i % 3 === 0 ? "cs-twinkle" : undefined} cx={rand(i, 1) * W} cy={4 + rand(i, 2) * 80} r={0.5 + rand(i, 3) * 0.7} />
      ))}
    </g>
  );
}

/** The sun crosses the sky as the day's hours are spent; the moon comes up after it sets. */
function SunAndMoon({ hour }: { hour: number }) {
  const t = (hour - 6) / 14;
  const sun = { x: 18 + t * 324, y: 128 - Math.sin(Math.PI * Math.min(1, t)) * 100 };
  const m = Math.max(0, Math.min(1, (hour - 19) / 6));
  const moon = { x: 316 - m * 120, y: 124 - m * 88 };
  return (
    <>
      {hour < 20.5 && (
        <g>
          <circle cx={sun.x} cy={sun.y} r={22} fill="url(#campus-sun)" opacity={0.7} />
          <circle cx={sun.x} cy={sun.y} r={10} fill="#ffd45c" stroke="#f2a93b" strokeWidth={1.2} />
        </g>
      )}
      {hour >= 19 && (
        <g opacity={Math.min(1, (hour - 19) / 1.5)}>
          <circle cx={moon.x} cy={moon.y} r={8} fill="#f4f1de" stroke="#d9d3b4" strokeWidth={1} />
          <circle cx={moon.x - 2.5} cy={moon.y - 1.5} r={1.6} fill="#e2dcc0" />
          <circle cx={moon.x + 2.5} cy={moon.y + 2.5} r={1.1} fill="#e2dcc0" />
        </g>
      )}
    </>
  );
}

/** [x, y, scale, seconds to cross]. */
const CLOUDS: [number, number, number, number][] = [
  [40, 26, 1, 70],
  [180, 14, 0.8, 95],
  [290, 36, 0.9, 80],
];

function Clouds({ opacity }: { opacity: number }) {
  return (
    <g opacity={opacity} fill="#fff">
      {CLOUDS.map(([x, y, s, dur], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g
            className="cs-drift"
            style={{ "--from": `${-(x / s + 50)}px`, "--to": `${(W - x) / s + 30}px`, animationDuration: `${dur}s`, animationDelay: `${(-rand(i, 5) * dur).toFixed(1)}s` } as Vars}
          >
            <path d="M0 8 a7 7 0 0 1 9 -7 a9 9 0 0 1 16 1 a6 6 0 0 1 8 6 Z" opacity={0.92} />
          </g>
        </g>
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

function Pennant({ x, y, color }: { x: number; y: number; color: string | null }) {
  if (!color) return null;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 V-14" {...ink} strokeWidth={1.1} />
      <path className="cs-flag" d="M0 -14 L11 -10.5 L0 -7 Z" fill={color} {...thin} />
    </g>
  );
}

function Library({ flag }: { flag: string | null }) {
  return (
    <g>
      <Pennant x={10} y={98} color={flag} />
      <rect x={9} y={137} width={68} height={3} fill="#d8c49a" {...thin} />
      <rect x={12} y={134} width={62} height={3} fill="#e2cfa6" {...thin} />
      <rect x={10} y={102} width={66} height={32} fill="#ecd7a8" {...ink} />
      {[19.2, 29.2, 53.2, 63.2].map((x) => (
        <rect key={x} x={x} y={108} width={3.6} height={20} rx={1.8} fill={GLASS} {...thin} />
      ))}
      <path d="M39 134 V118 a4 4 0 0 1 8 0 V134 Z" fill="#7a4e2d" {...ink} />
      {[14, 24, 34, 48, 58, 68].map((x) => (
        <rect key={x} x={x} y={103} width={4} height={31} fill="#fbf3de" {...thin} />
      ))}
      {/* The Writing Center's banner. */}
      <path d="M66.5 105 h7.5 v12.5 l-3.75 -2.6 l-3.75 2.6 z" fill="#3f6fd6" {...thin} />
      <path d="M70.25 107.5 l1.6 3.4 -1.6 1.6 -1.6 -1.6 z" fill="#fff" />
      <rect x={7} y={98} width={72} height={5} fill="#f6e6c2" {...ink} />
      <path d="M7 98 L43 82 L79 98 Z" fill="#f6e6c2" {...ink} />
      <circle cx={43} cy={92} r={3.4} fill={GLASS} {...thin} />
    </g>
  );
}

function OldMain({ flag, hour }: { flag: string | null; hour: number }) {
  return (
    <g>
      <Pennant x={111} y={24} color={flag} />
      <path d="M111 28 V24" {...ink} />
      <rect x={86} y={98} width={50} height={42} fill="#ddd3c0" {...ink} />
      {[90.5, 97.5, 120, 127].map((x) =>
        [103, 116, 128].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={5} height={y === 128 ? 7 : 8} fill={GLASS} {...thin} />),
      )}
      <path d="M106 140 V129 a5 5 0 0 1 10 0 V140 Z" fill="#6b4a2f" {...ink} />
      <rect x={103} y={50} width={16} height={49} fill="#e6ddcc" {...ink} />
      {[106, 113].map((x) => (
        <path key={x} d={`M${x} 61 V56 a1.5 1.5 0 0 1 3 0 V61 Z`} fill="#3b3550" {...thin} />
      ))}
      <Clock hour={hour} />
      <path d="M83 99 L91 90 H131 L139 99 Z" fill="#5d6680" {...ink} />
      <rect x={101} y={48} width={20} height={3} fill="#f1ebdf" {...thin} />
      <path d="M101 48 L111 28 L121 48 Z" fill="#5d6680" {...ink} />
    </g>
  );
}

/** Old Main's clock keeps the day's time: how much of the term's admin hours are gone. */
function Clock({ hour, lit = false }: { hour: number; lit?: boolean }) {
  const hourAngle = ((hour % 12) / 12) * 360;
  const minuteAngle = (hour % 1) * 360;
  return (
    <g>
      <circle cx={111} cy={72} r={6.2} fill={lit ? "#fff3c4" : "#fffdf6"} {...ink} />
      <path d="M111 72 V68.4" {...ink} strokeWidth={1.3} transform={`rotate(${hourAngle} 111 72)`} />
      <path d="M111 72 V67" {...ink} strokeWidth={0.8} transform={`rotate(${minuteAngle} 111 72)`} />
      <circle cx={111} cy={72} r={0.8} fill={INK} />
    </g>
  );
}

/** Humanities Hall's window grid: 5 across, 3 floors; the door takes the ground floor's middle. */
const HUM_COLS = [147.5, 160.5, 173.5, 186.5, 199.5];
const HUM_ROWS = [95, 108, 121];
/** Your office: second floor, second window. */
const OFFICE = { x: HUM_COLS[1]!, y: HUM_ROWS[1]! };

function Humanities({ flag }: { flag: string | null }) {
  return (
    <g>
      <Pennant x={210} y={87} color={flag} />
      <rect x={142} y={90} width={70} height={50} fill="#c4583f" {...ink} />
      <g stroke="#a8432e" strokeWidth={0.8}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={i} d={`M${146 + rand(i, 7) * 60} ${93 + i * 7.5} h5`} />
        ))}
      </g>
      {HUM_ROWS.map((y, r) =>
        HUM_COLS.map((x, c) => (r === 2 && c === 2 ? null : <rect key={`${r}-${c}`} x={x} y={y} width={7} height={9} fill={GLASS} {...thin} />)),
      )}
      <path d="M172 140 V128 a5 5 0 0 1 10 0 V140 Z" fill="#5a3a22" {...ink} />
      <rect x={140} y={87} width={74} height={4} fill="#f4ecdf" {...ink} />
      <path d="M140 87 L177 70 L214 87 Z" fill="#4b4560" {...ink} />
      <circle cx={177} cy={80} r={2.8} fill={GLASS} {...thin} />
    </g>
  );
}

function ArtsSciences({ flag }: { flag: string | null }) {
  return (
    <g>
      <Pennant x={262} y={91} color={flag} />
      <rect x={218} y={95} width={48} height={45} fill="#6f9f9a" {...ink} />
      {[222, 236.5, 251].map((x) =>
        [100, 113].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width={11} height={10} fill={GLASS} {...thin} />),
      )}
      <rect x={222} y={128} width={11} height={8} fill={GLASS} {...thin} />
      <rect x={251} y={128} width={11} height={8} fill={GLASS} {...thin} />
      <rect x={236.5} y={126} width={11} height={14} fill="#a9cfd8" {...ink} />
      <path d="M242 126 V140" {...thin} />
      <rect x={216} y={91} width={52} height={5} fill="#e9efe9" {...ink} />
    </g>
  );
}

const FOUNDERS = { x: 274.4, y: 92, dx: 6.6, dy: 7.2, w: 4.6, h: 4.8 } as const;

function windowAt(i: number): { x: number; y: number } {
  const col = i % FOUNDERS_WINDOWS.cols;
  const row = Math.floor(i / FOUNDERS_WINDOWS.cols);
  return { x: FOUNDERS.x + col * FOUNDERS.dx, y: FOUNDERS.y + row * FOUNDERS.dy };
}

const WINDOW_FILL: Record<WindowKind, string> = {
  tt: "var(--seg-tt)",
  ntt: "var(--seg-ntt)",
  gta: "var(--seg-gta)",
  adjunct: "var(--seg-adjunct)",
  gap: "#2a2238",
  cancelled: "#8a7a66",
};

/** One window per section, colored by who teaches it, as in the staffing planner. */
function Founders({ kinds }: { kinds: WindowKind[] }) {
  const room = FOUNDERS_WINDOWS.cols * FOUNDERS_WINDOWS.rows;
  return (
    <g>
      <rect x={330} y={80} width={12} height={6} fill="#b9a07a" {...thin} />
      <rect x={272} y={88} width={82} height={52} fill="#e3b562" {...ink} />
      <rect x={270} y={85} width={86} height={4} fill="#f6e8c7" {...ink} />
      {Array.from({ length: room }, (_, i) => {
        const { x, y } = windowAt(i);
        const kind = kinds[i];
        return (
          <g key={i}>
            <rect
              className={kind === "gap" ? "cs-gap" : undefined}
              x={x}
              y={y}
              width={FOUNDERS.w}
              height={FOUNDERS.h}
              fill={kind ? WINDOW_FILL[kind] : GLASS}
              stroke={kind === "gap" ? "var(--seg-gap)" : INK}
              strokeWidth={kind === "gap" ? 1 : 0.6}
            />
            {kind === "cancelled" && <path d={`M${x} ${y} l${FOUNDERS.w} ${FOUNDERS.h} M${x + FOUNDERS.w} ${y} l${-FOUNDERS.w} ${FOUNDERS.h}`} stroke="#4a3d2e" strokeWidth={0.8} />}
          </g>
        );
      })}
      <rect x={305} y={134} width={16} height={2.5} fill="#7a4e2d" {...thin} />
      <rect x={309} y={136.5} width={8} height={3.5} fill="#5a3a22" {...thin} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Grounds and life
// ---------------------------------------------------------------------------

function Hills({ season }: { season: "fall" | "spring" }) {
  const far = season === "fall" ? "#b9a56a" : "#9cc283";
  const near = season === "fall" ? "#c98a45" : "#74ad62";
  return (
    <g>
      <path d={`M0 118 Q40 100 90 112 T190 108 T290 104 T360 112 V${GROUND + 2} H0 Z`} fill={far} />
      <g fill={near} stroke={INK} strokeWidth={0.8}>
        {Array.from({ length: 16 }, (_, i) => (
          <circle key={i} cx={i * 24 + rand(i, 9) * 8} cy={GROUND - 4 - rand(i, 4) * 4} r={8 + rand(i, 6) * 4} />
        ))}
      </g>
    </g>
  );
}

function Grounds() {
  const lawn = "#7cbf5e";
  const path = "#efe3c6";
  return (
    <g>
      <rect y={GROUND} width={W} height={H - GROUND} fill={lawn} />
      <path d={`M0 ${GROUND} H${W}`} {...ink} />
      {[
        [40, 46],
        [109, 113],
        [175, 179],
        [240, 244],
        [311, 315],
      ].map(([a, b]) => (
        <path key={a} d={`M${a} ${GROUND} L${a! - 2} 166 H${b! + 2} L${b} ${GROUND} Z`} fill={path} />
      ))}
      <path d="M-5 171 C90 165 180 177 270 169 S345 167 365 170" fill="none" stroke="#d6c7a3" strokeWidth={12} />
      <path d="M-5 171 C90 165 180 177 270 169 S345 167 365 170" fill="none" stroke={path} strokeWidth={10} />
      <g fill="#6aac4f">
        {Array.from({ length: 18 }, (_, i) => (
          <path key={i} d={`M${rand(i, 11) * W} ${150 + rand(i, 12) * 40} l1 -3 l1 3`} />
        ))}
      </g>
    </g>
  );
}

function Road() {
  return (
    <g>
      <rect y={192} width={W} height={3} fill="#d7cfbe" />
      <rect y={195} width={W} height={15} fill="#55586a" />
      <path d={`M0 203 H${W}`} stroke="#f2d36b" strokeWidth={1} strokeDasharray="8 6" />
      {/* The bus stop. */}
      <path d="M338 192 V177" {...ink} strokeWidth={1.2} />
      <circle cx={338} cy={175} r={4.2} fill="#2b6fd6" {...thin} />
      <rect x={336} y={173.6} width={4} height={2.4} rx={0.6} fill="#fff" />
      <rect x={322} y={187} width={10} height={2} fill="#7a4e2d" {...thin} />
    </g>
  );
}

/** The 14 to campus, every half minute or so. */
function Bus() {
  return (
    <g transform="translate(-100 0)">
      <g className="cs-bus">
        <rect x={0} y={183} width={60} height={15} rx={3} fill="#2b6fd6" {...ink} />
        <rect x={4} y={186} width={46} height={5.5} rx={1} fill="#cfe7ff" {...thin} />
        <path d="M15.5 186 v5.5 M27 186 v5.5 M38.5 186 v5.5" {...thin} />
        <path d="M53 185.5 h4.5 v7 h-4.5 z" fill="#cfe7ff" {...thin} />
        <rect x={2} y={193.5} width={56} height={1.6} fill="#f2b544" />
        <circle cx={58.5} cy={194} r={1.1} fill="#fff3b0" />
        {[13, 47].map((x) => (
          <g key={x}>
            <circle cx={x} cy={198.5} r={3.6} fill={INK} />
            <circle cx={x} cy={198.5} r={1.3} fill="#b9bccb" />
          </g>
        ))}
      </g>
    </g>
  );
}

function Lamps() {
  return (
    <g>
      {LAMPS.map((x) => (
        <g key={x}>
          <path d={`M${x} 165 V149`} {...ink} strokeWidth={1.2} />
          <circle cx={x} cy={148} r={2.4} fill="#fff5d6" {...thin} />
        </g>
      ))}
    </g>
  );
}
const LAMPS = [62, 146, 226, 296];

function BikeRack() {
  return (
    <g>
      <path d="M183 186 h26" {...ink} strokeWidth={1.2} />
      {[
        [188, "#e2582f"],
        [200, "#3f9b74"],
      ].map(([x, color]) => {
        const cx = x as number;
        return (
          <g key={cx} fill="none">
            <circle cx={cx - 3.5} cy={183} r={3} {...thin} />
            <circle cx={cx + 3.5} cy={183} r={3} {...thin} />
            <path d={`M${cx - 3.5} 183 L${cx - 0.5} 179 L${cx + 3.5} 183 M${cx - 0.5} 179 L${cx + 2.5} 179 L${cx + 3.5} 183`} stroke={color as string} strokeWidth={1.2} />
          </g>
        );
      })}
    </g>
  );
}

function Tree({ x, y, i, season, big = false }: { x: number; y: number; i: number; season: "fall" | "spring"; big?: boolean }) {
  const s = big ? 1.25 : 1;
  const fall = ["#e07a2e", "#d9482b", "#f0b53a", "#e8902f"];
  const spring = ["#5fae55", "#4f9a4c", "#78bf5f", "#5aa65a"];
  const color = (season === "fall" ? fall : spring)[i % 4]!;
  const blobs: [number, number, number][] = [
    [-6, -14, 7.5],
    [6, -14, 7.5],
    [0, -22, 8.5],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-1.6} y={-11} width={3.2} height={11} fill="#6b4a2f" {...thin} />
      {blobs.map(([dx, dy, r], k) => (
        <circle key={`o${k}`} cx={dx} cy={dy} r={r} fill={INK} stroke={INK} strokeWidth={2.4} />
      ))}
      {blobs.map(([dx, dy, r], k) => (
        <circle key={k} cx={dx} cy={dy} r={r} fill={color} />
      ))}
      {season === "spring" && i % 2 === 0 && (
        <g fill="#f6a6c1">
          {[0, 1, 2, 3, 4].map((k) => (
            <circle key={k} cx={-8 + rand(i, k) * 16} cy={-26 + rand(i, k + 9) * 16} r={1.2} />
          ))}
        </g>
      )}
      {season === "fall" && (
        <g fill={fall[(i + 1) % 4]}>
          <ellipse cx={-7} cy={0.5} rx={2} ry={0.8} />
          <ellipse cx={6} cy={1} rx={1.8} ry={0.7} />
        </g>
      )}
    </g>
  );
}

const SHIRTS = ["#e2582f", "#4f46e5", "#3f9b74", "#f2b544", "#a45fc4", "#2b8fd6", "#d9432f", "#f08bb0"];
const SKIN = ["#f1c7a5", "#c68a5e", "#8d5a3b", "#e0ac83", "#a86b4a"];
const HAIR = ["#2b2222", "#5a3a22", "#c9a15a", INK];

function Person({ x, y, i, question = false, graduate = false, box = false }: { x: number; y: number; i: number; question?: boolean; graduate?: boolean; box?: boolean }) {
  const shirt = graduate ? "#2a2540" : SHIRTS[i % SHIRTS.length];
  return (
    <g transform={`translate(${x} ${y})`}>
      <Figure i={i} shirt={shirt!} graduate={graduate} box={box} />
      {question && (
        <g transform="translate(5 -20)">
          <circle r={3.6} fill="#fff" {...thin} />
          <path d="M-1.1 -1.1 a1.2 1.2 0 1 1 1.4 1.2 v0.8 M0.3 1.9 v0.2" fill="none" stroke={INK} strokeWidth={0.9} />
        </g>
      )}
    </g>
  );
}

function Figure({ i, shirt, graduate = false, box = false }: { i: number; shirt: string; graduate?: boolean; box?: boolean }) {
  return (
    <g>
      <path d="M-1 -4 L-1.6 0 M1 -4 L1.6 0" stroke="#2f2c45" strokeWidth={1.3} strokeLinecap="round" />
      {i % 3 === 1 && !graduate && <rect x={-4.3} y={-9.6} width={2.2} height={4.6} rx={0.8} fill={SHIRTS[(i + 3) % SHIRTS.length]} {...thin} />}
      <rect x={-2.6} y={-10} width={5.2} height={graduate ? 9 : 6.5} rx={2} fill={shirt} {...thin} />
      <circle cy={-12.6} r={2.4} fill={SKIN[i % SKIN.length]} {...thin} />
      {graduate ? (
        <path d="M-3.2 -15.2 L0 -16.4 L3.2 -15.2 L0 -14 Z M2.6 -15 v2" fill={INK} stroke={INK} strokeWidth={0.6} />
      ) : (
        <path d="M-2.4 -12.8 a2.4 2.4 0 0 1 4.8 0 Q0 -13.8 -2.4 -12.8 Z" fill={HAIR[i % HAIR.length]} />
      )}
      {box && <rect x={1} y={-9.4} width={5} height={4.2} fill="#c49a6c" {...thin} />}
    </g>
  );
}

/** Students on the quad: fewer as the day goes on, gowns at commencement. */
function Walkers({ count, graduates }: { count: number; graduates: boolean }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x0 = 12 + rand(i, 21) * (W - 24);
        const y = i % 2 ? 176 : 170.5;
        const left = i % 3 === 0;
        const dur = 22 + rand(i, 22) * 16;
        const from = left ? W + 12 - x0 : -12 - x0;
        const to = left ? -12 - x0 : W + 12 - x0;
        return (
          <g key={i} transform={`translate(${x0.toFixed(1)} ${y})`}>
            <g
              className="cs-walk"
              style={{ "--from": `${from.toFixed(1)}px`, "--to": `${to.toFixed(1)}px`, animationDuration: `${dur.toFixed(1)}s`, animationDelay: `${(-rand(i, 23) * dur).toFixed(1)}s` } as Vars}
            >
              <g className="cs-bob" transform={left ? "scale(-1 1)" : undefined}>
                <Figure i={i} shirt={graduates ? "#2a2540" : SHIRTS[i % SHIRTS.length]!} graduate={graduates} />
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** An instructor below the morale line, carrying a box of books to the bus stop. */
function Leaving() {
  const x0 = 150;
  return (
    <g transform={`translate(${x0} 177)`}>
      <g className="cs-walk" style={{ "--from": `${-x0 - 12}px`, "--to": `${330 - x0}px`, animationDuration: "48s" } as Vars}>
        <g className="cs-bob">
          <Figure i={7} shirt="#7c7f93" box />
        </g>
      </g>
    </g>
  );
}

/** Announced changes: a sign out front of Founders Hall for next term's schedule. */
function ScheduleSign() {
  return (
    <g transform="translate(284 158)">
      <path d="M-5 0 L-3 -9 M5 0 L3 -9" {...thin} />
      <rect x={-7} y={-16} width={14} height={9} rx={1.2} fill="#fffdf6" {...thin} />
      <rect x={-4} y={-14.5} width={8} height={6} rx={0.8} fill="none" stroke="#4f46e5" strokeWidth={0.9} />
      <path d="M-4 -12.6 h8 M-2 -15.5 v2 M2 -15.5 v2" stroke="#4f46e5" strokeWidth={0.9} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Lights, weather, and celebrations
// ---------------------------------------------------------------------------

function Lights({ dark, hour, workingLate, kinds }: { dark: number; hour: number; workingLate: boolean; kinds: WindowKind[] }) {
  if (dark <= 0) return null;
  const warm = "#ffd27a";
  // Some of Humanities Hall is still at work after dark; past your hours, only your office is.
  const humanities = HUM_ROWS.flatMap((y, r) => HUM_COLS.filter((_, c) => !(r === 2 && c === 2)).map((x) => ({ x, y }))).filter(
    ({ x, y }, i) => (x === OFFICE.x && y === OFFICE.y) || (!workingLate && rand(i, 31) < 0.55),
  );
  return (
    <g>
      {LAMPS.map((x) => (
        <circle key={x} cx={x} cy={148} r={16} fill="url(#campus-glow)" opacity={dark} />
      ))}
      <g opacity={dark}>
        {[19.2, 29.2, 53.2, 63.2].map((x, i) =>
          workingLate && i > 0 ? null : <rect key={x} x={x} y={108} width={3.6} height={20} rx={1.8} fill={warm} />,
        )}
        <circle cx={43} cy={92} r={3.4} fill={warm} />
        {!workingLate && [90.5, 127].map((x) => <rect key={x} x={x} y={103} width={5} height={8} fill={warm} />)}
        <Clock hour={hour} lit />
        {humanities.map(({ x, y }) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={7} height={9} fill={x === OFFICE.x && y === OFFICE.y ? "#fff0b8" : warm} />
        ))}
        {!workingLate && <rect x={251} y={100} width={11} height={10} fill={warm} />}
        {kinds.map((kind, i) => {
          if (kind === "cancelled") return null;
          const { x, y } = windowAt(i);
          return <rect key={i} x={x} y={y} width={FOUNDERS.w} height={FOUNDERS.h} fill={kind === "gap" ? "var(--seg-gap)" : WINDOW_FILL[kind]} opacity={workingLate ? 0.35 : 1} />;
        })}
      </g>
    </g>
  );
}

function Falling({ season, dim }: { season: "fall" | "spring"; dim: number }) {
  const colors = season === "fall" ? ["#e07a2e", "#d9482b", "#f0b53a"] : ["#f6a6c1", "#fbd3e0", "#f6a6c1"];
  return (
    <g opacity={1 - 0.5 * dim}>
      {Array.from({ length: 9 }, (_, i) => {
        const x = 10 + rand(i, 41) * (W - 20);
        const dur = 9 + rand(i, 42) * 7;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)} -12)`}>
            <g
              className="cs-fall"
              style={{ "--drift": `${(rand(i, 43) * 40 - 20).toFixed(1)}px`, animationDuration: `${dur.toFixed(1)}s`, animationDelay: `${(-rand(i, 44) * dur).toFixed(1)}s` } as Vars}
            >
              <ellipse rx={season === "fall" ? 2 : 1.6} ry={season === "fall" ? 1.1 : 1} fill={colors[i % 3]} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

function Commencement() {
  const colors = ["#e2582f", "#f2b544", "#4f46e5", "#3f9b74"];
  return (
    <g>
      <path d="M62 149 Q104 160 146 149 Q186 160 226 149 Q261 160 296 149" fill="none" stroke={INK} strokeWidth={0.8} />
      {Array.from({ length: 15 }, (_, i) => {
        const x = 68 + i * 15.5;
        return <path key={i} d={`M${x - 3} ${153.5 + (i % 5 === 2 ? 1.5 : 0)} h6 l-3 5 z`} fill={colors[i % 4]} {...thin} strokeWidth={0.6} />;
      })}
      {[128, 150, 172, 196, 218].map((x, i) => (
        <g key={x} transform={`translate(${x} 150)`}>
          <g className="cs-toss" style={{ animationDelay: `${(-i * 0.45).toFixed(2)}s` }}>
            <path d="M-4.5 0 L0 -1.8 L4.5 0 L0 1.8 Z" fill={INK} />
            <path d="M3.5 0 v3" stroke="#f2b544" strokeWidth={0.8} />
          </g>
        </g>
      ))}
    </g>
  );
}

/** Envelopes over the buildings where something is waiting on you. */
function Markers({ waiting }: { waiting: Map<BuildingId, WaitingItem[]> }) {
  return (
    <g>
      {BUILDINGS.map((b) => {
        const items = waiting.get(b.id);
        if (!items?.length) return null;
        const [x, y] = MARKER[b.id];
        const urgent = items.some((it) => it.urgent);
        return (
          <g key={b.id} transform={`translate(${x} ${y})`}>
            {urgent && <circle className="cs-ping" r={8} fill="none" stroke="#ff6b4a" strokeWidth={1.6} />}
            <g className="cs-marker">
              <path d="M-8 -6 h16 a2.5 2.5 0 0 1 2.5 2.5 v7 a2.5 2.5 0 0 1 -2.5 2.5 h-5.5 l-2.5 3 -2.5 -3 h-5.5 a2.5 2.5 0 0 1 -2.5 -2.5 v-7 a2.5 2.5 0 0 1 2.5 -2.5 z" fill={urgent ? "#ff6b4a" : "#fffdf6"} {...ink} strokeWidth={1.1} />
              <rect x={-5} y={-3.4} width={10} height={7} rx={0.8} fill={urgent ? "#ff6b4a" : "#fffdf6"} stroke={urgent ? "#fff" : INK} strokeWidth={0.9} />
              <path d="M-5 -3.4 L0 0.8 L5 -3.4" fill="none" stroke={urgent ? "#fff" : INK} strokeWidth={0.9} />
              {items.length > 1 && (
                <g transform="translate(9 -6)">
                  <circle r={4.4} fill={INK} stroke="#fff" strokeWidth={0.9} />
                  <text y={2.1} textAnchor="middle" fontSize={6} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">
                    {items.length}
                  </text>
                </g>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** A map pin on your office window. */
function YouAreHere() {
  const x = OFFICE.x + 3.5;
  const y = OFFICE.y;
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cy={0.4} rx={2} ry={0.7} fill="rgb(0 0 0 / 0.25)" />
      <path d="M0 0 C-3.6 -4.2 -4.2 -6 -4.2 -7.6 a4.2 4.2 0 0 1 8.4 0 C4.2 -6 3.6 -4.2 0 0 Z" fill="#e2582f" {...ink} strokeWidth={1} />
      <circle cy={-7.6} r={1.6} fill="#fff" />
    </g>
  );
}
