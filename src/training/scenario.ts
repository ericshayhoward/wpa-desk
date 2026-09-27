import { DEFAULT_ASSUMPTIONS, STAKEHOLDER_IDS, analyzeTerm, parseChange, type StakeholderId } from "../model";
import type {
  CareerStage,
  Consequence,
  DelayedEffect,
  EvidenceKind,
  Persuasion,
  Scenario,
  ScenarioDocument,
  ScenarioOption,
  ToolId,
  TrainingSession,
} from "./types";
import { termOf } from "./terms";

const STAGES: readonly CareerStage[] = ["assistant_director", "wpa", "program_builder"];
const TOOLS: readonly ToolId[] = ["cap_calculator"];
const EVIDENCE_KINDS: readonly EvidenceKind[] = ["cap_analysis"];
const GENRES: readonly ScenarioDocument["genre"][] = ["memo", "email", "report", "note"];

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
    stages: arr(r, "stages", at).map((s) => oneOf(s, STAGES, `${at} stages`)),
    trigger: {
      minTerm: trigger.minTerm === undefined ? undefined : num(trigger, "minTerm", `${at} trigger`),
      requiresDeficit: trigger.requiresDeficit === undefined ? undefined : bool(trigger, "requiresDeficit", `${at} trigger`),
    },
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
      adminHours: cost.adminHours === undefined ? 0 : num(cost, "adminHours", `${w} cost`),
      politicalCapital: cost.politicalCapital === undefined ? 0 : num(cost, "politicalCapital", `${w} cost`),
    },
    memo,
    consequence,
    persuasion,
  };
}

function parseConsequence(raw: unknown, at: string): Consequence {
  const r = obj(raw, at);
  const response = r.response === undefined ? undefined : obj(r.response, `${at} response`);
  return {
    narrative: str(r, "narrative", at).trim(),
    changes: (r.changes === undefined ? [] : arr(r, "changes", at)).map((c, i) => parseChange(c, `${at} change ${i + 1}`)),
    response: response && {
      from: stakeholder(response.from, `${at} response`),
      body: str(response, "body", `${at} response`).trim(),
    },
    delayed: (r.delayed === undefined ? [] : arr(r, "delayed", at)).map((d, i) => parseDelayed(d, `${at} delayed ${i + 1}`)),
  };
}

function parsePersuasion(raw: unknown, at: string): Persuasion {
  const r = obj(raw, at);
  return {
    evidenceKinds: arr(r, "evidenceKinds", at).map((k) => oneOf(k, EVIDENCE_KINDS, `${at} evidenceKinds`)),
    persuaded: parseConsequence(r.persuaded, `${at} persuaded`),
    unpersuaded: parseConsequence(r.unpersuaded, `${at} unpersuaded`),
  };
}

function parseDelayed(raw: unknown, at: string): DelayedEffect {
  const r = obj(raw, at);
  const inTerms = num(r, "inTerms", at);
  if (!Number.isInteger(inTerms) || inTerms < 1) throw new Error(`${at}: "inTerms" must be a whole number ≥ 1`);
  return {
    inTerms,
    note: str(r, "note", at).trim(),
    changes: arr(r, "changes", at).map((c, i) => parseChange(c, `${at} change ${i + 1}`)),
  };
}

// ---------------------------------------------------------------------------

/** Whether a scenario can arrive in the session's current term. */
export function isEligible(scenario: Scenario, session: TrainingSession): boolean {
  const t = scenario.trigger;
  if (!scenario.stages.includes(session.stage)) return false;
  if (t.minTerm !== undefined && session.termIndex < t.minTerm) return false;
  if (t.requiresDeficit) {
    const analysis = analyzeTerm(session.program, termOf(session.termIndex), DEFAULT_ASSUMPTIONS);
    if (analysis.budgetBalance >= 0) return false;
  }
  return true;
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
