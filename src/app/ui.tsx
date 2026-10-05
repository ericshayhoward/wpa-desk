import type { CSSProperties, ReactNode } from "react";
import type { Program, StakeholderId } from "../model";
import { CAST } from "../content";
import { characterFor, termLabel } from "../training";
import { portraitFor } from "./Portraits";

/* Small presentational pieces shared across views. All decoration is aria-hidden,
   so accessible names stay exactly what the text says. */

const ICONS = {
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  capital: (
    <>
      <path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7" />
      <path d="m12 2 8 5H4z" />
    </>
  ),
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  wallet: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  arrow: <path d="M5 12h14M12 5l7 7-7 7" />,
  back: <path d="M19 12H5M12 19l-7-7 7-7" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  folder: (
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  ),
  sliders: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  save: (
    <>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7" />
    </>
  ),
  cap: (
    <>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  desk: (
    <>
      <path d="M2 10h20M4 10v10M20 10v10M8 10v4h8v-4" />
      <path d="M9 10V6l3-3 3 3v4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />,
  hourglass: (
    <path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.41L12 12l-4.41 4.42A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.41L12 12l4.41-4.42A2 2 0 0 0 17 6.17V2" />
  ),
  promise: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  bulletin: (
    <>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
    </>
  ),
  flag: <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />,
  campus: (
    <>
      <path d="M3 21h18M5 21V11l7-4 7 4v10M12 7V3l3 1.5L12 6" />
      <path d="M9 21v-5h6v5M8.5 12h.01M15.5 12h.01" />
    </>
  ),
  collapse: <path d="m6 9 6 6 6-6" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={`icon ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  );
}

/** The app's mark: a stack of papers under a pen nib. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a5b" />
          <stop offset="1" stopColor="#f2b544" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#logo-bg)" />
      <rect x="11" y="15" width="22" height="24" rx="3" fill="#fff" opacity="0.55" transform="rotate(-8 22 27)" />
      <rect x="14" y="12" width="22" height="24" rx="3" fill="#fff" />
      <path d="M18 19h14M18 23.5h14M18 28h9" stroke="#2b2f63" strokeWidth="2" strokeLinecap="round" />
      <path d="M33 31l6-12 3 1.5-6 12-3.6 1.8z" fill="#2b2f63" />
    </svg>
  );
}

const HUES: Record<string, number> = {
  dean: 250,
  chair: 200,
  fyw_director: 340,
  provost_office: 28,
  faculty_senate: 160,
  writing_center: 280,
  gta_cohort: 45,
  adjunct_faculty: 12,
  students: 190,
  accreditor: 100,
};

function hueFor(id: string): number {
  if (id in HUES) return HUES[id]!;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function initials(name: string): string {
  const words = name.replace(/^(Dr\.|Dean|Associate Provost)\s+/, "").split(/\s+/).filter((w) => /^[A-Z]/.test(w));
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1]![0] : "")).toUpperCase() || "?";
}

/** A stakeholder's face: a person's cartoon portrait (or initials, if they have none), or a group glyph. */
export function Avatar({ program, id, size = 36 }: { program: Program; id: StakeholderId; size?: number }) {
  const c = characterFor(CAST, id);
  const name = c?.name ?? program.stakeholders.find((s) => s.id === id)?.name ?? id;
  const Portrait = portraitFor(c?.portrait);
  return (
    <span
      className={`avatar ${c ? "" : "avatar-group"} ${Portrait ? "avatar-portrait" : ""}`}
      style={{ "--hue": hueFor(id), width: size, height: size, fontSize: size * 0.38 } as CSSProperties}
      aria-hidden="true"
    >
      {Portrait ? <Portrait /> : c ? initials(name) : <Icon name="users" size={size * 0.5} />}
    </span>
  );
}

/**
 * Scenario prose: blank lines split paragraphs, a paragraph starting with an
 * em dash is a sign-off (its line breaks are kept), and "---" is a divider.
 */
export function Prose({ text }: { text: string }) {
  return (
    <>
      {text
        .trim()
        .split(/\n\s*\n/)
        .map((para, i) => {
          const t = para.trim();
          if (/^-{3,}$/.test(t)) return <hr key={i} className="doc-rule" />;
          if (t.startsWith("—")) {
            const lines = t.split("\n").map((l) => l.trim());
            return (
              <p key={i} className="signoff">
                {lines.map((l, j) => (
                  <span key={j}>
                    {j > 0 && <br />}
                    {l}
                  </span>
                ))}
              </p>
            );
          }
          return <p key={i}>{para}</p>;
        })}
    </>
  );
}

/** A thin progress bar for a stat tile. */
export function Bar({ value, tone }: { value: number; tone?: "warn" | "good" | "accent" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className={`bar ${tone ?? ""}`} aria-hidden="true">
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/** Where the player is in the arc: one stop per term. */
export function TermTrack({ terms, current }: { terms: number; current: number }) {
  return (
    <ol className="term-track" aria-label={`Term ${current} of ${terms}`}>
      {Array.from({ length: terms }, (_, i) => i + 1).map((t) => (
        <li key={t} className={t < current ? "past" : t === current ? "now" : ""} aria-current={t === current ? "step" : undefined}>
          <span className="dot" aria-hidden="true">
            {t < current && <Icon name="check" size={11} />}
          </span>
          <span className="term-name" title={termLabel(t)}>
            {termLabel(t).startsWith("Fall") ? "Fall" : "Spr"} {Math.ceil(t / 2)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Section heading inside a card, with an icon chip. */
export function CardTitle({ icon, children, id, level = 2 }: { icon: IconName; children: ReactNode; id?: string; level?: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <H className="card-title" id={id}>
      <span className="icon-chip" aria-hidden="true">
        <Icon name={icon} size={16} />
      </span>
      <span>{children}</span>
    </H>
  );
}
