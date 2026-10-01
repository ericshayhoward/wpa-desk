import type { CSSProperties, ReactNode } from "react";

/* Cartoon head-and-shoulders portraits for the cast, in a 90s Saturday-morning
   style: thick ink outlines, flat bright fills, big eyes. Each draws on a
   100×100 canvas and sits on the avatar's colored circle, which clips it.
   A cast entry picks its drawing with `portrait:` (src/content/cast/). */

const INK = "#1f1b2d";
const ink = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** Background doodles: the squiggles and confetti every 90s title card had. */
function Confetti() {
  return (
    <g fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" opacity={0.45}>
      <path d="M10 22 q4 -5 8 0 t8 0" />
      <path d="M78 14 l6 4 -6 4" />
      <circle cx="86" cy="40" r="3" />
      <path d="M8 46 l5 -4" />
    </g>
  );
}

function Eyes({ y = 45, dx = 8, look = 0.6 }: { y?: number; dx?: number; look?: number }) {
  return (
    <g>
      {[-1, 1].map((side) => (
        <g key={side}>
          <ellipse cx={50 + side * dx} cy={y} rx={4.6} ry={5.6} fill="#fff" {...ink} strokeWidth={2} />
          <circle cx={50 + side * dx + look} cy={y + 0.8} r={2} fill={INK} />
        </g>
      ))}
    </g>
  );
}

/** Shoulders in a top, with an optional inner layer showing at the neckline. */
function Torso({ top, inner }: { top: string; inner?: string }) {
  return (
    <g>
      <rect x={43} y={60} width={14} height={18} fill="var(--skin)" {...ink} />
      <path d="M12 104 C14 84 28 75 50 75 C72 75 86 84 88 104 Z" fill={top} {...ink} />
      {inner && <path d="M41 76 L50 90 L59 76 Z" fill={inner} {...ink} strokeWidth={2.2} />}
    </g>
  );
}

function Frame({ skin, children }: { skin: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ "--skin": skin } as CSSProperties}>
      <Confetti />
      {children}
    </svg>
  );
}

/** Dean Alvarez: economist, overbooked. Salt-and-pepper hair, mustache, a suit that's seen a lot of budget meetings. */
function Alvarez() {
  const skin = "#c68a5e";
  return (
    <Frame skin={skin}>
      <Torso top="#2f3e7a" inner="#fff" />
      <path d="M48 79 L52 79 L54 95 L50 99 L46 95 Z" fill="#d9443b" {...ink} strokeWidth={2} />
      <path d="M41 76 L36 92 M59 76 L64 92" {...ink} fill="none" strokeWidth={2} />
      <circle cx={32} cy={47} r={5} fill={skin} {...ink} />
      <circle cx={68} cy={47} r={5} fill={skin} {...ink} />
      <path d="M32 40 C32 24 40 18 50 18 C60 18 68 24 68 40 L68 52 C68 64 60 70 50 70 C40 70 32 64 32 52 Z" fill={skin} {...ink} />
      <path d="M31 42 C29 22 40 14 52 15 C63 15 71 22 69 42 C67 34 65 29 60 27 C53 31 42 30 37 28 C34 32 33 36 31 42 Z" fill="#8d8b98" {...ink} />
      <path d="M44 20 C48 22 54 22 58 20" stroke="#c9c8d2" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M38 37 L47 36 M53 36 L62 37" {...ink} strokeWidth={3} fill="none" />
      <Eyes y={45} dx={7.5} look={0.4} />
      <g fill="none" {...ink} strokeWidth={2}>
        <rect x={36.5} y={39} width={13} height={11} rx={3} />
        <rect x={50.5} y={39} width={13} height={11} rx={3} />
      </g>
      <path d="M50 49 C47 54 48 57 52 57" {...ink} fill="none" strokeWidth={2} />
      <path d="M41 61 C44 57 48 57 50 59 C52 57 56 57 59 61 C55 62.5 52 61.5 50 60.5 C48 61.5 45 62.5 41 61 Z" fill="#5b5560" {...ink} strokeWidth={2} />
      <path d="M46 65 Q50 66.5 54 65" {...ink} fill="none" strokeWidth={2} />
    </Frame>
  );
}

/** Dr. Hale: a medievalist chair. Graying temples and a cowlick, a trimmed goatee, half-moon reading glasses, tweed and a bow tie. */
function Hale() {
  const skin = "#f1c7a5";
  const hair = "#8a6a4f";
  return (
    <Frame skin={skin}>
      <Torso top="#8b6a45" inner="#bfd8f2" />
      <path d="M44 81 L50 84 L56 81 L56 87 L50 84 L44 87 Z" fill="#2f8a57" {...ink} strokeWidth={1.8} />
      <g stroke="#6e5232" strokeWidth={1.4} opacity={0.6}>
        <path d="M22 92 l4 -4 M28 96 l4 -4 M68 88 l4 4 M74 94 l4 4" />
      </g>
      <circle cx={32.5} cy={47} r={5} fill={skin} {...ink} />
      <circle cx={67.5} cy={47} r={5} fill={skin} {...ink} />
      <ellipse cx={50} cy={46} rx={17.5} ry={21.5} fill={skin} {...ink} />
      <path
        d="M32 44 C28 28 36 16 50 15 C64 15 72 26 68 44 C66 36 63 30 58 27 C53 29.5 45 29.5 40 27 C36 30 33 36 32 44 Z"
        fill={hair}
        {...ink}
      />
      <path d="M49 15.5 C47 10 52 7 56 9.5 C53 10 51 12 52 15.5" fill={hair} {...ink} strokeWidth={2} />
      <path d="M33.5 41 C33 37 34 33 36 30.5 M66.5 41 C67 37 66 33 64 30.5" stroke="#d8d0c4" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M37 35 Q42 31 47 34 M53 34 Q58 31 63 35" {...ink} fill="none" strokeWidth={3} />
      <Eyes y={41.5} dx={7.5} look={0} />
      <path d="M50 46 C47 52 48 56 52 56" {...ink} fill="none" strokeWidth={2} />
      <g {...ink} strokeWidth={1.8} fill="none">
        <path d="M37.5 50 L47.5 50 Q47.5 54.5 42.5 54.5 Q37.5 54.5 37.5 50 Z" />
        <path d="M52.5 50 L62.5 50 Q62.5 54.5 57.5 54.5 Q52.5 54.5 52.5 50 Z" />
        <path d="M47.5 50.5 Q50 49 52.5 50.5" />
      </g>
      <path d="M42 60 C45 57 48 57 50 58.5 C52 57 55 57 58 60 C55 61 52 60.5 50 59.5 C48 60.5 45 61 42 60 Z" fill={hair} {...ink} strokeWidth={1.8} />
      <path d="M46 63 Q50 65 54 63" {...ink} fill="none" strokeWidth={2} />
      <path d="M44 65.5 Q50 67.5 56 65.5 Q56 72 50 75.5 Q44 72 44 65.5 Z" fill={hair} {...ink} strokeWidth={2} />
    </Frame>
  );
}

/** Dr. Cherry: your supervisor. A cherry-red bob, cat-eye glasses, cherry earrings, a teal cardigan. */
function Cherry() {
  const skin = "#e8b08a";
  const hair = "#b8323f";
  return (
    <Frame skin={skin}>
      <path d="M26 50 C24 26 36 14 50 14 C64 14 76 26 74 50 C74 60 73 66 70 70 L30 70 C27 66 26 60 26 50 Z" fill={hair} {...ink} />
      <Torso top="#2a9d8f" inner="#f2b544" />
      <circle cx={40} cy={86} r={1.8} fill="#fff" />
      <circle cx={60} cy={86} r={1.8} fill="#fff" />
      <circle cx={33} cy={49} r={4} fill={skin} {...ink} />
      <circle cx={67} cy={49} r={4} fill={skin} {...ink} />
      <ellipse cx={50} cy={46} rx={17} ry={20.5} fill={skin} {...ink} />
      <path d="M33 41 C33 24 42 19 50 19 C58 19 67 24 67 41 C63 35 59 31 55 34 C51 30 45 30 41 35 C38 33 35 36 33 41 Z" fill={hair} {...ink} />
      <path d="M44 23 Q50 21 56 23" stroke="#e86a76" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Eyes y={47} dx={7.5} look={0.8} />
      <g fill="none" stroke="#6b3fa0" strokeWidth={2.4} strokeLinejoin="round">
        <path d="M35 43 Q42 40 49 43 L48 50 Q42 53 37 50 Z" />
        <path d="M65 43 Q58 40 51 43 L52 50 Q58 53 63 50 Z" />
        <path d="M35 43 L32.5 40.5 M65 43 L67.5 40.5" />
      </g>
      <path d="M50 51 C48 55 49 57 51.5 57" {...ink} fill="none" strokeWidth={2} />
      <path d="M43 60 Q50 66 57 60" {...ink} fill="#fff" strokeWidth={2.2} />
      <circle cx={39} cy={58} r={2.4} fill="#f08a8a" opacity={0.6} />
      <circle cx={61} cy={58} r={2.4} fill="#f08a8a" opacity={0.6} />
      {/* Cherry earrings hanging from each lobe; the right one mirrors the left. */}
      {["", "translate(100 0) scale(-1 1)"].map((flip) => (
        <g key={flip} transform={flip || undefined}>
          <path d="M31 52 q-0.6 2.6 -1.4 4.6" stroke="#3c8d3c" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M31 52.4 q-2.6 -0.6 -3.4 1.2 q2 0.8 3.4 -1.2 Z" fill="#3c8d3c" />
          <circle cx={29.4} cy={58.6} r={2.6} fill="#d61f3c" {...ink} strokeWidth={1.4} />
        </g>
      ))}
    </Frame>
  );
}

/** Associate Provost Okafor: retention data every week. Close-cropped natural hair, a sharp blazer, gold hoops. */
function Okafor() {
  const skin = "#7a4a2e";
  return (
    <Frame skin={skin}>
      <Torso top="#5b3fa0" inner="#fff" />
      <path d="M41 76 L37 90 M59 76 L63 90" {...ink} fill="none" strokeWidth={2} />
      <circle cx={33} cy={48} r={5} fill={skin} {...ink} />
      <circle cx={67} cy={48} r={5} fill={skin} {...ink} />
      <ellipse cx={50} cy={47} rx={17.5} ry={21} fill={skin} {...ink} />
      <path d="M32 44 C29 24 39 14 50 14 C61 14 71 24 68 44 C66 36 62 31 50 30 C38 31 34 36 32 44 Z" fill="#231a1a" {...ink} />
      <g fill="#4a3a3a">
        <circle cx={42} cy={21} r={1.3} />
        <circle cx={52} cy={19} r={1.3} />
        <circle cx={60} cy={23} r={1.3} />
        <circle cx={47} cy={26} r={1.3} />
      </g>
      <path d="M38 39 Q42 37 47 39 M53 39 Q58 37 62 39" {...ink} fill="none" strokeWidth={2.6} />
      <Eyes y={46} dx={7.5} look={0} />
      <path d="M50 50 C48 55 49 57 52 57" stroke="#3a2214" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M42 60 Q50 68 58 60 Z" fill="#fff" {...ink} strokeWidth={2.2} />
      <g fill="none" stroke="#f2b544" strokeWidth={2.2}>
        <circle cx={31.5} cy={57} r={3.6} />
        <circle cx={68.5} cy={57} r={3.6} />
      </g>
      <path d="M44 80 Q50 84 56 80" stroke="#f2b544" strokeWidth={2} fill="none" />
    </Frame>
  );
}

/** Dr. Raman: runs the writing center. Long dark hair tucked behind one ear, a pencil resting there, a bright scarf. */
function Raman() {
  const skin = "#a8693f";
  const hair = "#2a1f2b";
  return (
    <Frame skin={skin}>
      <path d="M28 48 C26 24 38 15 50 15 C62 15 74 24 72 48 L76 86 L24 86 Z" fill={hair} {...ink} />
      <Torso top="#3f8f4f" />
      <path d="M34 78 C42 86 58 86 66 78 C64 72 58 70 50 72 C42 70 36 72 34 78 Z" fill="#f26b3a" {...ink} strokeWidth={2.2} />
      <path d="M58 82 L62 98 L54 98 Z" fill="#f26b3a" {...ink} strokeWidth={2.2} />
      <path d="M40 79 l3 2 M48 81 l3 1 M58 79 l-3 2" stroke="#ffd166" strokeWidth={1.8} strokeLinecap="round" />
      <g transform="translate(70 41) rotate(121)">
        <rect x={-12} y={-2.3} width={20} height={4.6} fill="#f7c948" {...ink} strokeWidth={1.6} />
        <path d="M8 -2.3 L13 0 L8 2.3 Z" fill="#f1d3a8" {...ink} strokeWidth={1.4} />
        <rect x={-15} y={-2.3} width={3} height={4.6} fill="#f08a8a" {...ink} strokeWidth={1.4} />
      </g>
      <circle cx={67.5} cy={47} r={5} fill={skin} {...ink} />
      <ellipse cx={50} cy={46} rx={17} ry={20.5} fill={skin} {...ink} />
      <path d="M33 44 C32 25 41 19 50 19 C59 19 68 25 67 44 C63 33 56 27 50 24 C44 27 37 33 33 44 Z" fill={hair} {...ink} />
      <path d="M64 37 Q71 38 72.5 45" stroke={hair} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <path d="M38 38 Q42 36 47 38.5 M53 38.5 Q58 36 62 38" {...ink} fill="none" strokeWidth={2.4} />
      <Eyes y={45} dx={7.5} look={-0.7} />
      <path d="M50 49 C48 54 49 56 52 56" stroke="#5c3418" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M44 60.5 Q50 64.5 56 60.5" {...ink} fill="none" strokeWidth={2.2} />
    </Frame>
  );
}

const PORTRAITS: Record<string, () => ReactNode> = {
  alvarez: Alvarez,
  hale: Hale,
  cherry: Cherry,
  okafor: Okafor,
  raman: Raman,
};

/** The drawing a cast entry names, or undefined when there's no such drawing. */
export function portraitFor(name: string | undefined): (() => ReactNode) | undefined {
  return name ? PORTRAITS[name] : undefined;
}
