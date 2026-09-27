import {
  DEFAULT_ASSUMPTIONS,
  STAFFING_ORDER,
  STAKEHOLDER_IDS,
  TERMS,
  analyzeTerm,
  parseChange,
  type ProgramChange,
  type StakeholderId,
  type Term,
  type TermAnalysis,
} from "../model";
import { CAREER_STAGES } from "./types";
import type {
  AmountRef,
  ComputedChange,
  Consequence,
  EvidenceKind,
  Persuasion,
  Scenario,
  ScenarioChange,
  ScenarioDelayed,
  ScenarioDocument,
  ScenarioOption,
  ToolId,
  TrainingSession,
  TriggerAfter,
  TriggerCondition,
  TriggerMeasure,
} from "./types";
import { termOf } from "./terms";

const TOOLS: readonly ToolId[] = ["cap_calculator", "staffing_planner"];
const EVIDENCE_KINDS: readonly EvidenceKind[] = ["cap_analysis", "staffing_plan"];
const GENRES: readonly ScenarioDocument["genre"][] = ["memo", "email", "report", "note"];
const MEASURES: readonly TriggerMeasure[] = ["trust", "morale", "dfw", "politicalCapital", "budgetBalance", "cap"];

/**
 * Validates an untyped scenario (usually parsed YAML) and returns a typed
 * Scenario. Errors name the exact field so content authors can fix them.
 */
export function parseScenario(raw: unknown): Scenario {
  const r = obj(raw, "scenario");
  const id = str(r, "id", "scenario");
  const at = `scenario "${id}"`;

  const options = arr(r, "options", at).map((o, i) => parseOption(o, `${at} option ${i + 1}`));
  if (options.length < 2) throw new Error(`${at}: needs at least two options`);
  const ids = new Set(options.map((o) => o.id));
  if (ids.size !== options.length) throw new Error(`${at}: option ids must be unique`);

  const trigger = r.trigger === undefined ? {} : obj(r.trigger, `${at} trigger`);
  const debrief = obj(r.debrief, `${at} debrief`);

  return {
    id,
    title: str(r, "title", at),
    stages: arr(r, "stages", at).map((s) => oneOf(s, CAREER_STAGES, `${at} stages`)),
    trigger: {
      minTerm: trigger.minTerm === undefined ? undefined : wholeTerm(trigger, "minTerm", `${at} trigger`),
      term: trigger.term === undefined ? undefined : oneOf(trigger.term, TERMS as readonly Term[], `${at} trigger term`),
      requiresDeficit: trigger.requiresDeficit === undefined ? undefined : bool(trigger, "requiresDeficit", `${at} trigger`),
      requiresUnstaffed:
        trigger.requiresUnstaffed === undefined ? undefined : bool(trigger, "requiresUnstaffed", `${at} trigger`),
      after: trigger.after === undefined ? undefined : parseAfter(trigger.after, `${at} trigger after`),
      conditions:
        trigger.conditions === undefined
          ? undefined
          : arr(trigger, "conditions", `${at} trigger`).map((c, i) => parseCondition(c, `${at} trigger condition ${i + 1}`)),
    },
    arrival: (r.arrival === undefined ? [] : arr(r, "arrival", at)).map((c, i) => parseChange(c, `${at} arrival ${i + 1}`)),
    urgent: r.urgent === undefined ? false : bool(r, "urgent", at),
    documents: arr(r, "documents", at).map((d, i) => {
      const w = `${at} document ${i + 1}`;
      const doc = obj(d, w);
      return {
        from: stakeholder(doc.from, w),
        genre: oneOf(doc.genre, GENRES, `${w} genre`),
        subject: str(doc, "subject", w),
        body: str(doc, "body", w).trim(),
      };
    }),
    suggestedTools: (r.suggestedTools === undefined ? [] : arr(r, "suggestedTools", at)).map((t) =>
      oneOf(t, TOOLS, `${at} suggestedTools`),
    ),
    options,
    debrief: {
      weighs: arr(debrief, "weighs", `${at} debrief`).map((x) => text(x, `${at} debrief.weighs`)),
      perspectives: (debrief.perspectives === undefined ? [] : arr(debrief, "perspectives", `${at} debrief`)).map((p, i) => {
        const w = `${at} perspective ${i + 1}`;
        const po = obj(p, w);
        return { stakeholder: stakeholder(po.stakeholder, w), view: str(po, "view", w).trim() };
      }),
      readings: (debrief.readings === undefined ? [] : arr(debrief, "readings", `${at} debrief`)).map((x) =>
        text(x, `${at} debrief.readings`),
      ),
    },
  };
}

function parseOption(raw: unknown, at: string): ScenarioOption {
  const r = obj(raw, at);
  const id = str(r, "id", at);
  const w = `${at} ("${id}")`;
  const cost = r.cost === undefined ? {} : obj(r.cost, `${w} cost`);
  const memoRaw = r.memo === undefined ? null : obj(r.memo, `${w} memo`);
  const memo = memoRaw && {
    required: memoRaw.required === undefined ? false : bool(memoRaw, "required", `${w} memo`),
    audience: stakeholder(memoRaw.audience, `${w} memo`),
    prompt: str(memoRaw, "prompt", `${w} memo`).trim(),
  };
  const requiresRaw = r.requires === undefined ? null : obj(r.requires, `${w} requires`);
  const requires = requiresRaw && {
    stakeholder: stakeholder(requiresRaw.stakeholder, `${w} requires`),
    minTrust: num(requiresRaw, "minTrust", `${w} requires`),
  };
  const consequence = r.consequence === undefined ? null : parseConsequence(r.consequence, `${w} consequence`);
  const persuasion = r.persuasion === undefined ? null : parsePersuasion(r.persuasion, `${w} persuasion`);

  if ((consequence === null) === (persuasion === null)) {
    throw new Error(`${w}: needs exactly one of "consequence" or "persuasion"`);
  }
  if (r.delayed !== undefined) {
    throw new Error(`${w}: put "delayed" inside the consequence it belongs to`);
  }
  if (persuasion && !memo?.required) {
    throw new Error(`${w}: persuasion options must require a memo`);
  }

  return {
    id,
    label: str(r, "label", w),
    description: str(r, "description", w),
    cost: {
      adminHours: cost.adminHours === undefined ? 0 : nonNegative(cost, "adminHours", `${w} cost`),
      politicalCapital: cost.politicalCapital === undefined ? 0 : nonNegative(cost, "politicalCapital", `${w} cost`),
    },
    memo,
    requires,
    consequence,
    persuasion,
  };
}

function parseConsequence(raw: unknown, at: string): Consequence {
  const r = obj(raw, at);
  const response = r.response === undefined ? undefined : obj(r.response, `${at} response`);
  return {
    narrative: str(r, "narrative", at).trim(),
    changes: (r.changes === undefined ? [] : arr(r, "changes", at)).map((c, i) => parseScenarioChange(c, `${at} change ${i + 1}`)),
    response: response && {
      from: stakeholder(response.from, `${at} response`),
      body: str(response, "body", `${at} response`).trim(),
      warm: response.warm === undefined ? undefined : str(response, "warm", `${at} response`).trim(),
      cool: response.cool === undefined ? undefined : str(response, "cool", `${at} response`).trim(),
    },
    delayed: (r.delayed === undefined ? [] : arr(r, "delayed", at)).map((d, i) => parseDelayed(d, `${at} delayed ${i + 1}`)),
  };
}

function parseScenarioChange(raw: unknown, at: string): ScenarioChange {
  const r = obj(raw, at);
  if (r.kind === "cancelUnstaffed") return { kind: "cancelUnstaffed", courseId: str(r, "courseId", at) };
  return parseMaybeComputed(r, at);
}

/**
 * A ProgramChange whose numeric fields may name a program value instead of a
 * number (`delta: { of: deficit }`). The rest of the change is validated as
 * usual, with a stand-in number where each value will go.
 */
function parseMaybeComputed(r: Record<string, unknown>, at: string): ProgramChange | ComputedChange {
  const amounts: Record<string, AmountRef> = {};
  const standIn: Record<string, unknown> = { ...r };
  for (const [k, v] of Object.entries(r)) {
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    amounts[k] = parseAmountRef(v, `${at} ${k}`);
    standIn[k] = 1;
  }
  const change = parseChange(standIn, at);
  return Object.keys(amounts).length ? { kind: "computed", change, amounts } : change;
}

function parseAmountRef(raw: unknown, at: string): AmountRef {
  const r = obj(raw, at);
  const times = r.times === undefined ? undefined : num(r, "times", at);
  const of = oneOf(r.of, ["deficit", "pay"] as const, `${at} of`);
  if (of === "deficit") {
    const term = r.term === undefined ? undefined : oneOf(r.term, TERMS as readonly Term[], `${at} term`);
    return { of, ...(term && { term }), ...(times !== undefined && { times }) };
  }
  return { of, rank: oneOf(r.rank, STAFFING_ORDER, `${at} rank`), ...(times !== undefined && { times }) };
}

function parsePersuasion(raw: unknown, at: string): Persuasion {
  const r = obj(raw, at);
  return {
    evidenceKinds: arr(r, "evidenceKinds", at).map((k) => oneOf(k, EVIDENCE_KINDS, `${at} evidenceKinds`)),
    persuaded: parseConsequence(r.persuaded, `${at} persuaded`),
    unpersuaded: parseConsequence(r.unpersuaded, `${at} unpersuaded`),
  };
}

function parseAfter(raw: unknown, at: string): TriggerAfter {
  const r = obj(raw, at);
  const inTerms = r.inTerms === undefined ? undefined : num(r, "inTerms", at);
  if (inTerms !== undefined && (!Number.isInteger(inTerms) || inTerms < 1)) {
    throw new Error(`${at}: "inTerms" must be a whole number ≥ 1`);
  }
  return {
    scenario: str(r, "scenario", at),
    options: r.options === undefined ? undefined : arr(r, "options", at).map((o) => text(o, `${at} options`)),
    persuaded: r.persuaded === undefined ? undefined : bool(r, "persuaded", at),
    inTerms,
  };
}

function parseCondition(raw: unknown, at: string): TriggerCondition {
  const r = obj(raw, at);
  const measure = oneOf(r.measure, MEASURES, `${at} measure`);
  const c: TriggerCondition = {
    measure,
    below: r.below === undefined ? undefined : num(r, "below", at),
    atLeast: r.atLeast === undefined ? undefined : num(r, "atLeast", at),
  };
  if (c.below === undefined && c.atLeast === undefined) throw new Error(`${at}: needs "below", "atLeast", or both`);
  if (measure === "trust") c.stakeholder = stakeholder(r.stakeholder, at);
  if (measure === "morale") c.rank = oneOf(r.rank, STAFFING_ORDER, `${at} rank`);
  if (measure === "dfw" && r.courseId !== undefined) c.courseId = str(r, "courseId", at);
  if (measure === "cap") c.courseId = str(r, "courseId", at);
  if (measure === "dfw" && ((c.below ?? 0) > 1 || (c.atLeast ?? 0) > 1)) {
    throw new Error(`${at}: D/F/W thresholds are fractions (0.22 means 22%)`);
  }
  return c;
}

/**
 * Checks references between scenarios, which a single file can't: every
 * `trigger.after` must name a real scenario and real options.
 */
export function validateScenarioLinks(scenarios: Scenario[]): void {
  const ids = new Set<string>();
  for (const s of scenarios) {
    if (ids.has(s.id)) throw new Error(`scenario "${s.id}": another scenario has the same id`);
    ids.add(s.id);
  }
  for (const s of scenarios) {
    const after = s.trigger.after;
    if (!after) continue;
    const target = scenarios.find((x) => x.id === after.scenario);
    if (!target) throw new Error(`scenario "${s.id}" trigger after: no scenario "${after.scenario}"`);
    for (const o of after.options ?? []) {
      if (!target.options.some((x) => x.id === o)) {
        throw new Error(`scenario "${s.id}" trigger after: "${after.scenario}" has no option "${o}"`);
      }
    }
  }
}

function parseDelayed(raw: unknown, at: string): ScenarioDelayed {
  const r = obj(raw, at);
  const inTerms = num(r, "inTerms", at);
  if (!Number.isInteger(inTerms) || inTerms < 1) throw new Error(`${at}: "inTerms" must be a whole number ≥ 1`);
  return {
    inTerms,
    ...(r.announced !== undefined && { announced: bool(r, "announced", at) }),
    note: str(r, "note", at).trim(),
    changes: arr(r, "changes", at).map((c, i) => parseMaybeComputed(obj(c, `${at} change ${i + 1}`), `${at} change ${i + 1}`)),
  };
}

// ---------------------------------------------------------------------------

/**
 * Whether a scenario can arrive in the session's current term. Pass a
 * session whose program already includes the scenario's arrival changes.
 */
export function isEligible(scenario: Scenario, session: TrainingSession): boolean {
  const t = scenario.trigger;
  if (!scenario.stages.includes(session.stage)) return false;
  if (t.minTerm !== undefined && session.termIndex < t.minTerm) return false;
  if (t.term !== undefined && termOf(session.termIndex) !== t.term) return false;
  if (t.after && !afterHolds(t.after, session)) return false;
  let analysis: TermAnalysis | undefined;
  const analyze = () => (analysis ??= analyzeTerm(session.program, termOf(session.termIndex), DEFAULT_ASSUMPTIONS));
  if (t.requiresDeficit && analyze().budgetBalance >= 0) return false;
  if (t.requiresUnstaffed && analyze().unstaffedSections === 0) return false;
  for (const c of t.conditions ?? []) {
    const v = measure(c, session, analyze);
    if (c.below !== undefined && !(v < c.below)) return false;
    if (c.atLeast !== undefined && !(v >= c.atLeast)) return false;
  }
  return true;
}

function afterHolds(after: TriggerAfter, session: TrainingSession): boolean {
  const d = session.decisions.find((x) => x.scenarioId === after.scenario);
  if (!d) return false;
  if (after.options && !after.options.includes(d.optionId)) return false;
  if (after.persuaded !== undefined && d.persuaded !== after.persuaded) return false;
  if (after.inTerms !== undefined && session.termIndex < d.termIndex + after.inTerms) return false;
  return true;
}

function measure(c: TriggerCondition, session: TrainingSession, analyze: () => TermAnalysis): number {
  const p = session.program;
  switch (c.measure) {
    case "trust":
      return p.stakeholders.find((s) => s.id === c.stakeholder)?.trust ?? 0;
    case "morale":
      return p.instructors.find((i) => i.rank === c.rank)?.morale ?? 0;
    case "politicalCapital":
      return p.politicalCapital;
    case "budgetBalance":
      return analyze().budgetBalance;
    case "cap": {
      const cap = p.policies.caps[c.courseId!];
      if (cap === undefined) throw new Error(`Trigger condition names an unknown course: ${c.courseId}`);
      return cap;
    }
    case "dfw": {
      if (!c.courseId) return analyze().dfw.mid;
      const course = analyze().courses.find((x) => x.courseId === c.courseId);
      if (!course) throw new Error(`Trigger condition names an unknown course: ${c.courseId}`);
      return course.dfw.mid;
    }
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
function text(v: unknown, at: string): string {
  if (typeof v !== "string") throw new Error(`${at}: expected text`);
  return v.trim();
}
function num(r: Record<string, unknown>, k: string, at: string): number {
  if (typeof r[k] !== "number" || !Number.isFinite(r[k])) throw new Error(`${at}: "${k}" must be a number`);
  return r[k] as number;
}
function wholeTerm(r: Record<string, unknown>, k: string, at: string): number {
  const v = num(r, k, at);
  if (!Number.isInteger(v) || v < 1) throw new Error(`${at}: "${k}" must be a whole number ≥ 1`);
  return v;
}
/** Costs are spent, never refunded: a negative cost would push admin hours past the term's total. */
function nonNegative(r: Record<string, unknown>, k: string, at: string): number {
  const v = num(r, k, at);
  if (v < 0) throw new Error(`${at}: "${k}" can't be negative`);
  return v;
}
function bool(r: Record<string, unknown>, k: string, at: string): boolean {
  if (typeof r[k] !== "boolean") throw new Error(`${at}: "${k}" must be true or false`);
  return r[k] as boolean;
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
