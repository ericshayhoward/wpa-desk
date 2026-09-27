import { CAREER_STAGES, type Arc, type ArcEntry, type ArcStageChange, type Scenario, type TrainingSession } from "./types";

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

  return {
    id,
    title: str(r, "title", at),
    description: str(r, "description", at).trim(),
    terms,
    startStage: stage(r.startStage, `${at} startStage`),
    stageChanges,
    calendar,
  };
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
function stage(v: unknown, at: string) {
  if (typeof v !== "string" || !(CAREER_STAGES as readonly string[]).includes(v)) {
    throw new Error(`${at}: "${String(v)}" is not one of ${CAREER_STAGES.join(", ")}`);
  }
  return v as (typeof CAREER_STAGES)[number];
}
