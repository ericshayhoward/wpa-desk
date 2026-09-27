import { STAKEHOLDER_IDS, type StakeholderId } from "../model";
import {
  CAREER_STAGES,
  type Arc,
  type ArcEntry,
  type ArcStageChange,
  type EndingId,
  type EndingsSpec,
  type ReportSectionId,
  type Scenario,
  type ScenarioDocument,
  type TimeCost,
  type TrainingSession,
  type YearEndSpec,
} from "./types";

export const REPORT_SECTION_IDS: readonly ReportSectionId[] = [
  "program_data",
  "assessment",
  "initiatives",
  "requests",
  "looking_back",
];
const ENDING_IDS: readonly EndingId[] = ["tenure_track", "two_year", "rotated_out"];
const GENRES: readonly ScenarioDocument["genre"][] = ["memo", "email", "report", "note"];

/**
 * Validates an untyped arc (usually parsed YAML) against the scenarios it
 * schedules. Errors name the exact field so content authors can fix them.
 */
export function parseArc(raw: unknown, scenarios: Scenario[]): Arc {
  const r = obj(raw, "arc");
  const id = str(r, "id", "arc");
  const at = `arc "${id}"`;
  const terms = whole(r, "terms", at, 1);

  const stageChanges = (r.stageChanges === undefined ? [] : arr(r, "stageChanges", at)).map((c, i): ArcStageChange => {
    const w = `${at} stage change ${i + 1}`;
    const o = obj(c, w);
    const term = whole(o, "term", w, 2);
    if (term > terms) throw new Error(`${w}: term ${term} is after the arc's last term (${terms})`);
    return { term, stage: stage(o.stage, w), note: str(o, "note", w).trim() };
  });
  for (let i = 1; i < stageChanges.length; i++) {
    if (stageChanges[i]!.term <= stageChanges[i - 1]!.term) throw new Error(`${at}: stage changes must be in term order`);
  }

  const calendar = arr(r, "calendar", at).map((e, i): ArcEntry => {
    const w = `${at} calendar entry ${i + 1}`;
    const o = obj(e, w);
    const scenario = str(o, "scenario", w);
    if (!scenarios.some((s) => s.id === scenario)) throw new Error(`${w}: no scenario "${scenario}"`);
    const from = whole(o, "from", w, 1);
    const until = o.until === undefined ? undefined : whole(o, "until", w, from);
    if ((until ?? from) > terms) throw new Error(`${w}: the window runs past the arc's last term (${terms})`);
    return { scenario, from, until };
  });
  if (new Set(calendar.map((e) => e.scenario)).size !== calendar.length) {
    throw new Error(`${at}: each scenario can appear in the calendar only once`);
  }

  const timeCosts = (r.timeCosts === undefined ? [] : arr(r, "timeCosts", at)).map((c, i): TimeCost => {
    const w = `${at} time cost ${i + 1}`;
    const o = obj(c, w);
    const term = whole(o, "term", w, 1);
    if (term > terms) throw new Error(`${w}: term ${term} is after the arc's last term (${terms})`);
    return { term, hours: whole(o, "hours", w, 1), label: str(o, "label", w), note: str(o, "note", w).trim() };
  });

  const yearEnd = (r.yearEnd === undefined ? [] : arr(r, "yearEnd", at)).map((y, i) => parseYearEnd(y, `${at} year-end ${i + 1}`, terms));
  if (new Set(yearEnd.map((y) => y.term)).size !== yearEnd.length) throw new Error(`${at}: only one year-end report per term`);
  const capstones = yearEnd.filter((y) => y.capstone);
  if (capstones.length > 1) throw new Error(`${at}: only one year-end report can be the capstone`);
  if (capstones[0] && capstones[0].term !== terms) throw new Error(`${at}: the capstone report must be due in the last term (${terms})`);

  let dissertation: Arc["dissertation"] = null;
  if (r.dissertation !== undefined) {
    const w = `${at} dissertation`;
    const d = obj(r.dissertation, w);
    const onTrackAt = num(d, "onTrackAt", w);
    if (onTrackAt <= 0 || onTrackAt > 1) throw new Error(`${w}: "onTrackAt" is a share between 0 and 1`);
    dissertation = { hoursToFinish: whole(d, "hoursToFinish", w, 1), onTrackAt };
  }

  const endings = r.endings === undefined ? null : parseEndings(r.endings, `${at} endings`);
  if (endings && !capstones[0]) throw new Error(`${at}: endings need a capstone year-end report to trigger them`);

  return {
    id,
    title: str(r, "title", at),
    description: str(r, "description", at).trim(),
    terms,
    startStage: stage(r.startStage, `${at} startStage`),
    stageChanges,
    calendar,
    timeCosts,
    yearEnd,
    dissertation,
    endings,
  };
}

function parseYearEnd(raw: unknown, at: string, terms: number): YearEndSpec {
  const o = obj(raw, at);
  const term = whole(o, "term", at, 1);
  if (term > terms) throw new Error(`${at}: term ${term} is after the arc's last term (${terms})`);
  const sections = arr(o, "sections", at).map((x) => oneOf(x, REPORT_SECTION_IDS, `${at} sections`));
  const playerSections = arr(o, "playerSections", at).map((x) => oneOf(x, REPORT_SECTION_IDS, `${at} playerSections`));
  if (playerSections.length === 0) throw new Error(`${at}: "playerSections" needs at least one section`);
  for (const p of playerSections) {
    if (!sections.includes(p)) throw new Error(`${at}: player section "${p}" isn't one of the report's sections`);
  }
  const from = o.from === "player" ? "player" : stakeholder(o.from, `${at} from`);
  if (from === "player" && playerSections.length !== sections.length) {
    throw new Error(`${at}: when the player is the author, every section is theirs`);
  }
  const req = obj(o.request, `${at} request`);
  const reply = o.reply === undefined ? null : obj(o.reply, `${at} reply`);
  return {
    term,
    from,
    to: stakeholder(o.to, `${at} to`),
    hours: whole(o, "hours", at, 1),
    request: {
      from: stakeholder(req.from, `${at} request`),
      genre: oneOf(req.genre, GENRES, `${at} request genre`),
      subject: str(req, "subject", `${at} request`),
      body: str(req, "body", `${at} request`).trim(),
    },
    sections,
    playerSections,
    reply: reply && { from: stakeholder(reply.from, `${at} reply`), body: str(reply, "body", `${at} reply`).trim() },
    capstone: o.capstone === undefined ? false : o.capstone === true,
  };
}

function parseEndings(raw: unknown, at: string): EndingsSpec {
  const o = obj(raw, at);
  const tenureTrackAt = num(o, "tenureTrackAt", at);
  const twoYearAt = num(o, "twoYearAt", at);
  if (!(twoYearAt > 0 && twoYearAt < tenureTrackAt && tenureTrackAt <= 100)) {
    throw new Error(`${at}: need 0 < twoYearAt < tenureTrackAt ≤ 100`);
  }
  const outcomesRaw = obj(o.outcomes, `${at} outcomes`);
  const outcomes = Object.fromEntries(
    ENDING_IDS.map((id) => {
      const e = obj(outcomesRaw[id], `${at} outcomes.${id}`);
      return [id, { title: str(e, "title", `${at} outcomes.${id}`), narrative: str(e, "narrative", `${at} outcomes.${id}`).trim() }];
    }),
  ) as EndingsSpec["outcomes"];
  return {
    tenureTrackAt,
    twoYearAt,
    relationships: arr(o, "relationships", at).map((x) => stakeholder(x, `${at} relationships`)),
    recommender: stakeholder(o.recommender, `${at} recommender`),
    outcomes,
  };
}

/** Admin hours this term costs before the player spends any (e.g., job applications). */
export function timeCostAt(arc: Arc | undefined, termIndex: number): TimeCost | undefined {
  return arc?.timeCosts.find((c) => c.term === termIndex);
}

/** Whether the arc lets a scenario arrive in the session's current term. */
export function arcAllows(arc: Arc, scenarioId: string, termIndex: number): boolean {
  const e = arc.calendar.find((x) => x.scenario === scenarioId);
  return !!e && termIndex >= e.from && termIndex <= (e.until ?? arc.terms);
}

/** The stage change that begins in this term, if any. */
export function stageChangeAt(arc: Arc, termIndex: number): ArcStageChange | undefined {
  return arc.stageChanges.find((c) => c.term === termIndex);
}

export function isFinalTerm(session: TrainingSession, arc: Arc | undefined): boolean {
  return !!arc && session.termIndex >= arc.terms;
}

/** Guards against playing a session with a different arc than it started with. */
export function checkArc(session: TrainingSession, arc: Arc | undefined): void {
  if ((session.arcId ?? null) !== (arc?.id ?? null)) {
    throw new Error(`This session belongs to ${session.arcId ? `the "${session.arcId}" arc` : "free play"}, not ${arc ? `"${arc.id}"` : "free play"}.`);
  }
}

// ---- small validators ------------------------------------------------------

function obj(v: unknown, at: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${at}: expected an object`);
  return v as Record<string, unknown>;
}
function arr(r: Record<string, unknown>, k: string, at: string): unknown[] {
  if (!Array.isArray(r[k])) throw new Error(`${at}: "${k}" must be a list`);
  return r[k] as unknown[];
}
function str(r: Record<string, unknown>, k: string, at: string): string {
  if (typeof r[k] !== "string" || (r[k] as string).trim() === "") throw new Error(`${at}: "${k}" must be non-empty text`);
  return r[k] as string;
}
function whole(r: Record<string, unknown>, k: string, at: string, min: number): number {
  const v = r[k];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) throw new Error(`${at}: "${k}" must be a whole number ≥ ${min}`);
  return v;
}
function num(r: Record<string, unknown>, k: string, at: string): number {
  if (typeof r[k] !== "number" || !Number.isFinite(r[k])) throw new Error(`${at}: "${k}" must be a number`);
  return r[k] as number;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], at: string): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    throw new Error(`${at}: "${String(v)}" is not one of ${allowed.join(", ")}`);
  }
  return v as T;
}
function stakeholder(v: unknown, at: string): StakeholderId {
  return oneOf(v, STAKEHOLDER_IDS, `${at} stakeholder`);
}
function stage(v: unknown, at: string) {
  if (typeof v !== "string" || !(CAREER_STAGES as readonly string[]).includes(v)) {
    throw new Error(`${at}: "${String(v)}" is not one of ${CAREER_STAGES.join(", ")}`);
  }
  return v as (typeof CAREER_STAGES)[number];
}
