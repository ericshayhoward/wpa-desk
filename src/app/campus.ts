/**
 * The campus view's reading of the game: which building each stakeholder
 * works in, what's waiting where, how far through the day the term's admin
 * hours have run, and what Founders Hall's windows show. Pure functions, so
 * the drawing in CampusScene.tsx only has to paint what this decides.
 *
 * Nothing here is a model relationship (those live in src/model/assumptions.ts):
 * these are display choices, named so the drawing has no unexplained numbers.
 */
import { MORALE_ATTRITION, termOf, fillTemplate, type Scenario, type TrainingSession, type YearEndSpec } from "../training";
import { RANK_LABELS, STAFFING_ORDER, type Rank, type StakeholderId, type TermAnalysis } from "../model";
import { TRUST_METER } from "./format";

export type BuildingId = "library" | "old_main" | "humanities" | "arts_sciences" | "founders" | "quad";

export interface Building {
  id: BuildingId;
  name: string;
  /** What the place is to the player, in a line. */
  tagline: string;
  /** Who works or meets here. The first is who the building is "about". */
  occupants: StakeholderId[];
}

/** Left to right, as drawn. */
export const BUILDINGS: readonly Building[] = [
  {
    id: "library",
    name: "Kessler Library",
    tagline: "The Writing Center, and your dissertation carrel on the third floor",
    occupants: ["writing_center"],
  },
  {
    id: "old_main",
    name: "Old Main",
    tagline: "The provost's suite, the Faculty Senate chamber, and where accreditors visit",
    occupants: ["provost_office", "faculty_senate", "accreditor"],
  },
  {
    id: "humanities",
    name: "Humanities Hall",
    tagline: "The English Department and the writing program office. Your office is on the second floor",
    occupants: ["fyw_director", "chair", "gta_cohort", "adjunct_faculty"],
  },
  {
    id: "arts_sciences",
    name: "Arts & Sciences Hall",
    tagline: "The dean's office, where the instruction budget gets signed",
    occupants: ["dean"],
  },
  {
    id: "founders",
    name: "Founders Hall",
    tagline: "Where first-year writing meets. Each window is a section this term",
    occupants: [],
  },
  {
    id: "quad",
    name: "The Quad",
    tagline: "Students between classes",
    occupants: ["students"],
  },
];

export function building(id: BuildingId): Building {
  return BUILDINGS.find((b) => b.id === id)!;
}

/** Where a stakeholder works. Every stakeholder has exactly one building. */
export function buildingOf(id: StakeholderId): BuildingId {
  return BUILDINGS.find((b) => b.occupants.includes(id))?.id ?? "humanities";
}

// ---------------------------------------------------------------------------
// Trust flags
// ---------------------------------------------------------------------------

export type TrustBand = "low" | "mid" | "high";

/** The same bands as the People card's meters. */
export function trustBand(trust: number): TrustBand {
  return trust < TRUST_METER.low ? "low" : trust < TRUST_METER.high ? "mid" : "high";
}

/** A building's flag shows its weakest relationship: the lowest trust among the people inside. */
export function buildingTrust(session: TrainingSession, id: BuildingId): number | null {
  const inside = building(id).occupants;
  const trusts = session.program.stakeholders.filter((s) => inside.includes(s.id)).map((s) => s.trust);
  return trusts.length ? Math.min(...trusts) : null;
}

// ---------------------------------------------------------------------------
// The day: admin hours as daylight
// ---------------------------------------------------------------------------

/** A term's admin hours run from 8 a.m. (all left) to 10 p.m. (none left). */
export const DAY = { start: 8, end: 22 } as const;
/** Overtime pushes past 10 p.m.: a quarter hour of clock per hour worked, up to 1 a.m. */
const OVERTIME = { clockPerHour: 0.25, maxClock: 3 } as const;
/** The golden hour commencement is held in. */
const COMMENCEMENT_HOUR = 18;

export interface DayClock {
  /** Hour of the day, 8 to 25 (25 = 1 a.m.). */
  hour: number;
  /** Morning, afternoon, … */
  label: string;
  /** Share of the term's admin hours spent, 0–1. */
  spent: number;
  overtime: number;
}

export function dayClock(session: TrainingSession): DayClock {
  if (session.ending) return { hour: COMMENCEMENT_HOUR, label: "Commencement", spent: 1, overtime: 0 };
  const total = Math.max(1, session.adminHoursPerTerm);
  const left = Math.max(0, Math.min(total, session.adminHoursRemaining));
  const spent = 1 - left / total;
  const overtime = Math.max(0, session.overtimeHours ?? 0);
  const hour =
    DAY.start + spent * (DAY.end - DAY.start) + (left === 0 ? Math.min(OVERTIME.maxClock, overtime * OVERTIME.clockPerHour) : 0);
  return { hour, label: timeOfDay(hour), spent, overtime };
}

export function timeOfDay(hour: number): string {
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  if (hour < 19.5) return "early evening";
  if (hour < 22) return "evening";
  if (hour < 24) return "night";
  return "after midnight";
}

/** "3:45 PM" for the clock tower's label. */
export function clockText(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor(((hour % 1) * 60) / 5) * 5;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export interface Sky {
  top: string;
  mid: string;
  horizon: string;
  /** 0 by day, 1 at night: dims the campus and lights the windows. */
  darkness: number;
}

/** Sky colors through the day, interpolated between these hours. */
const SKY_STOPS: [hour: number, top: string, mid: string, horizon: string][] = [
  [8, "#6fb9ec", "#a9dbf7", "#f7e3c2"],
  [12, "#4aa3e6", "#8acbf2", "#d8f0fb"],
  [16, "#5795d6", "#9ec5ea", "#f4ddb0"],
  [18.5, "#3c4b97", "#c46a8c", "#fba55a"],
  [20, "#1e2459", "#4a3a72", "#8b4f6d"],
  [22, "#0d1230", "#171d44", "#272a55"],
  [25, "#070a1f", "#0d1230", "#191c40"],
];
const DUSK = { from: 17, to: 21 } as const;

export function skyAt(hour: number): Sky {
  const h = Math.max(SKY_STOPS[0]![0], Math.min(SKY_STOPS[SKY_STOPS.length - 1]![0], hour));
  let i = 0;
  while (i < SKY_STOPS.length - 2 && h > SKY_STOPS[i + 1]![0]) i++;
  const a = SKY_STOPS[i]!;
  const b = SKY_STOPS[i + 1]!;
  const t = (h - a[0]) / (b[0] - a[0]);
  return {
    top: mix(a[1], b[1], t),
    mid: mix(a[2], b[2], t),
    horizon: mix(a[3], b[3], t),
    darkness: Math.max(0, Math.min(1, (hour - DUSK.from) / (DUSK.to - DUSK.from))),
  };
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// What's waiting, and where
// ---------------------------------------------------------------------------

export interface WaitingItem {
  kind: "scenario" | "report" | "staffing";
  /** The scenario id, for kind "scenario". */
  id: string;
  from: StakeholderId | null;
  subject: string;
  urgent: boolean;
}

export function waitingByBuilding(
  session: TrainingSession,
  scenarios: Scenario[],
  reportDue?: YearEndSpec | null,
  staffingDue?: { unstaffed: number } | null,
): Map<BuildingId, WaitingItem[]> {
  const out = new Map<BuildingId, WaitingItem[]>();
  const add = (b: BuildingId, item: WaitingItem) => out.set(b, [...(out.get(b) ?? []), item]);
  if (staffingDue) {
    add("founders", {
      kind: "staffing",
      id: "staffing",
      from: null,
      subject: `${staffingDue.unstaffed} section${staffingDue.unstaffed === 1 ? "" : "s"} still need an instructor`,
      urgent: true,
    });
  }
  if (reportDue) {
    const from = reportDue.request.from;
    add(buildingOf(from), { kind: "report", id: "report", from, subject: reportDue.request.subject, urgent: true });
  }
  for (const id of session.inbox) {
    const s = scenarios.find((x) => x.id === id);
    const doc = s?.documents[0];
    if (!s || !doc) continue;
    add(buildingOf(doc.from), { kind: "scenario", id, from: doc.from, subject: fillTemplate(doc.subject, session), urgent: !!s.urgent });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Founders Hall: one window per section
// ---------------------------------------------------------------------------

export type WindowKind = Rank | "gap" | "cancelled";

/** Founders Hall's facade has room for this many windows (12 across, 6 floors). */
export const FOUNDERS_WINDOWS = { cols: 12, rows: 6 } as const;

export interface Windows {
  /** In facade order: taught by rank (full-time first), then unstaffed, then cancelled. */
  kinds: WindowKind[];
  /** Sections each window stands for (1 unless the schedule outgrows the facade). */
  perWindow: number;
}

export function foundersWindows(analysis: TermAnalysis): Windows {
  const counts: [WindowKind, number][] = [
    ...STAFFING_ORDER.map((rank): [WindowKind, number] => [rank, analysis.staffing.find((s) => s.rank === rank)?.sectionsAssigned ?? 0]),
    ["gap", analysis.unstaffedSections],
    ["cancelled", analysis.totalSectionsCancelled],
  ];
  const total = counts.reduce((n, [, c]) => n + c, 0);
  const room = FOUNDERS_WINDOWS.cols * FOUNDERS_WINDOWS.rows;
  const perWindow = Math.max(1, Math.ceil(total / room));
  const kinds: WindowKind[] = [];
  for (const [kind, n] of counts) {
    // Round up so a single unstaffed or cancelled section never disappears.
    for (let i = 0; i < Math.ceil(n / perWindow) && kinds.length < room; i++) kinds.push(kind);
  }
  return { kinds, perWindow };
}

export const WINDOW_LABELS: Record<WindowKind, string> = {
  ...RANK_LABELS,
  gap: "No instructor yet",
  cancelled: "Cancelled",
};

// ---------------------------------------------------------------------------
// People out and about
// ---------------------------------------------------------------------------

/** Walkers on the quad: one per this many seated students, within these bounds. */
const WALKERS = { studentsEach: 100, min: 2, max: 14, nightShare: 0.3 } as const;
/** Students turned away by cancelled sections: one per this many, up to a small crowd. */
const STRANDED = { studentsEach: 40, max: 3 } as const;

export interface CampusLife {
  walkers: number;
  /** Students without a seat this term, waiting outside Founders Hall. */
  stranded: number;
  /** Someone carrying a box to the bus stop: an instructor pool below the morale line. */
  leaving: Rank | null;
  season: "fall" | "spring";
}

export function campusLife(session: TrainingSession, analysis: TermAnalysis, darkness: number): CampusLife {
  const base = Math.max(WALKERS.min, Math.min(WALKERS.max, Math.round(analysis.totalSeatsServed / WALKERS.studentsEach)));
  const walkers = Math.max(1, Math.round(base * (1 - (1 - WALKERS.nightShare) * darkness)));
  const unserved = analysis.totalSeatsUnserved;
  const stranded = unserved > 0 ? Math.min(STRANDED.max, Math.ceil(unserved / STRANDED.studentsEach)) : 0;
  const low = session.program.instructors.find(
    (p) => (MORALE_ATTRITION.ranks as readonly Rank[]).includes(p.rank) && p.morale < MORALE_ATTRITION.threshold,
  );
  return { walkers, stranded, leaving: low?.rank ?? null, season: termOf(session.termIndex) };
}
