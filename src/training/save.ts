import { DEFAULT_ASSUMPTIONS, TERMS, analyzeTerm, parseChange, type Program } from "../model";
import { termLabel } from "./terms";
import { recordTerm } from "./history";
import { CAREER_STAGES, DEFAULT_SETTINGS, type Arc, type Scenario, type TrainingSession } from "./types";

export const SAVE_FORMAT = "wpa-desk-save";
/** Bump when the saved shape changes, and add a migration in parseSave. */
export const SAVE_VERSION = 7;

export interface SaveSummary {
  institution: string;
  term: string;
  decisions: number;
  memos: number;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: number;
  savedAt: string;
  label: string;
  summary: SaveSummary;
  session: TrainingSession;
}

export function summarize(session: TrainingSession): SaveSummary {
  return {
    institution: session.program.institution,
    term: termLabel(session.termIndex),
    decisions: session.decisions.length,
    memos: session.dossier.length,
  };
}

/** Wraps a session in a versioned save. `savedAt` is passed in to keep this pure. */
export function createSave(session: TrainingSession, label: string, savedAt: Date): SaveFile {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: savedAt.toISOString(),
    label,
    summary: summarize(session),
    session: JSON.parse(JSON.stringify(session)),
  };
}

/**
 * Validates a save from storage or an imported file. Saves are untrusted, so
 * every check fails with a message a player can act on instead of crashing
 * the app later.
 */
export function parseSave(raw: unknown, scenarios: Scenario[], arcs: Arc[] = []): SaveFile {
  const f = obj(raw, "This file");
  if (f.format !== SAVE_FORMAT) throw new Error("This isn't a WPA Desk save file.");
  if (typeof f.version !== "number") throw new Error("The save file has no version number.");
  if (f.version > SAVE_VERSION) {
    throw new Error("This save was made by a newer version of WPA Desk. Update the app to open it.");
  }
  let rawSession = f.session;
  if (f.version < 2) rawSession = migrate1to2(rawSession);
  if (f.version < 3) rawSession = migrate2to3(rawSession);
  if (f.version < 4) rawSession = migrate3to4(rawSession);
  // v5 added session settings; earlier saves were played with the defaults.
  if (f.version < 5) rawSession = { settings: DEFAULT_SETTINGS, ...obj(rawSession, "The saved session") };
  // v6 added routine staffing decisions.
  if (f.version < 6) rawSession = { staffingLog: [], ...obj(rawSession, "The saved session") };
  // v7 added feedback to endings; it's optional, so earlier endings load as they were.

  const session = parseSession(rawSession, scenarios, arcs);
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    savedAt: typeof f.savedAt === "string" ? f.savedAt : new Date(0).toISOString(),
    label: typeof f.label === "string" ? f.label : "Untitled save",
    summary: summarize(session),
    session,
  };
}

/**
 * v2 added effort, audience, and extension tracking to commitments. Old
 * commitments get a moderate effort and the audience of the memo they came from.
 */
function migrate1to2(raw: unknown): unknown {
  const s = obj(raw, "The saved session");
  const memos = Array.isArray(s.dossier) ? (s.dossier as Record<string, unknown>[]) : [];
  const commitments = Array.isArray(s.commitments) ? (s.commitments as Record<string, unknown>[]) : [];
  return {
    ...s,
    commitments: commitments.map((c) => ({
      audience: memos.find((m) => m.id === c.memoId)?.audience ?? "dean",
      effortHours: 4,
      extended: false,
      resolvedTerm: null,
      ...c,
    })),
  };
}

/**
 * v3 added arcs, the Director of First-Year Writing as a stakeholder, and
 * made the player an assistant director until the interim year. Earlier
 * saves become standard-arc sessions with the director at starting trust.
 */
function migrate2to3(raw: unknown): unknown {
  const s = obj(raw, "The saved session");
  const program = obj(s.program, "The saved program");
  const stakeholders = Array.isArray(program.stakeholders) ? (program.stakeholders as Record<string, unknown>[]) : [];
  const hasDirector = stakeholders.some((x) => x.id === "fyw_director");
  const termIndex = typeof s.termIndex === "number" ? s.termIndex : 1;
  return {
    ...s,
    arcId: "standard",
    stage: termIndex >= 5 ? "wpa" : "assistant_director",
    program: {
      ...program,
      stakeholders: hasDirector
        ? stakeholders
        : [
            ...stakeholders,
            {
              id: "fyw_director",
              name: "Director of First-Year Writing",
              trust: 60,
              priorities: ["program coherence", "instructor support", "mentoring graduate administrators"],
            },
          ],
    },
  };
}

/**
 * v4 added term history, year-end reports, and endings. Earlier saves start
 * with no history; their baseline is the program as it stands, since the
 * starting numbers weren't kept.
 */
function migrate3to4(raw: unknown): unknown {
  const s = obj(raw, "The saved session");
  return { history: [], overtimeHours: 0, reports: [], baselineFromCurrent: true, ...s };
}

function parseSession(raw: unknown, scenarios: Scenario[], arcs: Arc[]): TrainingSession {
  const s = obj(raw, "The saved session");
  const known = new Set(scenarios.map((x) => x.id));
  const scenarioId = (id: unknown, where: string) => {
    if (typeof id !== "string" || !known.has(id)) {
      throw new Error(`The save refers to a scenario this version doesn't have (${where}: ${String(id)}).`);
    }
    return id;
  };

  const program = parseProgram(s.program);
  const termIndex = int(s, "termIndex", 1);
  const session: TrainingSession = {
    program,
    settings: settings(s.settings),
    termIndex,
    stage: oneOf(s.stage, CAREER_STAGES, "career stage"),
    ...(s.arcId !== undefined && { arcId: arcId(s.arcId, arcs) }),
    adminHoursPerTerm: int(s, "adminHoursPerTerm", 0),
    adminHoursRemaining: int(s, "adminHoursRemaining", 0),
    inbox: list(s, "inbox").map((id) => scenarioId(id, "inbox")),
    decisions: list(s, "decisions").map((d) => {
      const r = obj(d, "A saved decision");
      scenarioId(r.scenarioId, "decisions");
      return r as unknown as TrainingSession["decisions"][number];
    }),
    pending: list(s, "pending").map((p) => {
      const r = obj(p, "A pending consequence");
      if (!Array.isArray(r.changes) || typeof r.dueTerm !== "number") throw new Error("A pending consequence is damaged.");
      // Checked now, so a damaged change can't crash the game later, when it comes due.
      try {
        r.changes.forEach((c) => parseChange(c));
      } catch {
        throw new Error("A pending consequence is damaged.");
      }
      return r as unknown as TrainingSession["pending"][number];
    }),
    evidence: list(s, "evidence") as TrainingSession["evidence"],
    dossier: list(s, "dossier") as TrainingSession["dossier"],
    commitments: list(s, "commitments").map((c) => {
      const r = obj(c, "A saved commitment");
      if (typeof r.effortHours !== "number" || typeof r.dueTerm !== "number" || typeof r.audience !== "string") {
        throw new Error("A saved commitment is damaged.");
      }
      return r as unknown as TrainingSession["commitments"][number];
    }),
    nextId: int(s, "nextId", 1),
    portfolio: parsePortfolio(s.portfolio),
    drafts: parseDrafts(s.drafts),
    history: list(s, "history").map((r) => termRecord(r, "A term in the history")),
    overtimeHours: int(s, "overtimeHours", 0),
    staffingLog: list(s, "staffingLog").map((d) => {
      const r = obj(d, "A saved staffing decision");
      if (typeof r.termIndex !== "number" || !["hire", "teach", "cancel"].includes(r.choice as string) || typeof r.sections !== "number") {
        throw new Error("A saved staffing decision is damaged.");
      }
      return r as unknown as TrainingSession["staffingLog"][number];
    }),
    reports: list(s, "reports").map((r) => {
      const o = obj(r, "A saved report");
      if (typeof o.termIndex !== "number" || !Array.isArray(o.sections) || typeof o.submittedAt !== "string") {
        throw new Error("A saved report is damaged.");
      }
      return o as unknown as TrainingSession["reports"][number];
    }),
    baseline: s.baselineFromCurrent
      ? recordTerm({ program, termIndex, adminHoursRemaining: 0, overtimeHours: 0 })
      : termRecord(s.baseline, "The saved baseline"),
    ...(s.reportDraft !== undefined && { reportDraft: reportDraft(s.reportDraft) }),
    ...(s.ending !== undefined && { ending: ending(s.ending) }),
  };
  if (session.adminHoursRemaining > session.adminHoursPerTerm) {
    throw new Error("The save's admin hours don't add up.");
  }
  return session;
}

function settings(raw: unknown): TrainingSession["settings"] {
  const r = obj(raw, "The saved settings");
  if (typeof r.id !== "string" || typeof r.label !== "string") throw new Error("The saved settings are damaged.");
  return { id: r.id, label: r.label };
}

function termRecord(raw: unknown, what: string): TrainingSession["history"][number] {
  const r = obj(raw, what);
  const dfw = r.dfw as Record<string, unknown> | undefined;
  if (
    typeof r.termIndex !== "number" ||
    typeof r.budgetBalance !== "number" ||
    typeof r.adminHoursUnspent !== "number" ||
    typeof dfw?.mid !== "number" ||
    !Array.isArray(r.trust) ||
    !Array.isArray(r.instructors)
  ) {
    throw new Error(`${what} is damaged.`);
  }
  return r as unknown as TrainingSession["history"][number];
}

function reportDraft(raw: unknown): TrainingSession["reportDraft"] {
  const r = obj(raw, "The saved report draft");
  if (typeof r.termIndex !== "number" || typeof r.startedAt !== "string" || typeof r.sections !== "object" || r.sections === null) {
    throw new Error("The saved report draft is damaged.");
  }
  return r as unknown as TrainingSession["reportDraft"];
}

function ending(raw: unknown): TrainingSession["ending"] {
  const r = obj(raw, "The saved ending");
  if (typeof r.id !== "string" || typeof r.score !== "number" || !Array.isArray(r.factors)) {
    throw new Error("The saved ending is damaged.");
  }
  return r as unknown as TrainingSession["ending"];
}

function arcId(v: unknown, arcs: Arc[]): string {
  if (typeof v !== "string" || (arcs.length > 0 && !arcs.some((a) => a.id === v))) {
    throw new Error(`The save belongs to a storyline this version doesn't have (${String(v)}).`);
  }
  return v;
}

function parseDrafts(raw: unknown): TrainingSession["drafts"] {
  if (raw === undefined) return undefined;
  const d = obj(raw, "The saved drafts");
  for (const [id, v] of Object.entries(d)) {
    const r = obj(v, `The saved draft for ${id}`);
    if (typeof r.optionId !== "string" || !Array.isArray(r.history) || typeof r.draft !== "object") {
      throw new Error(`The saved draft for ${id} is damaged.`);
    }
  }
  return d as TrainingSession["drafts"];
}

function parsePortfolio(raw: unknown): TrainingSession["portfolio"] {
  if (raw === undefined) return undefined;
  const p = obj(raw, "The saved portfolio details");
  if (typeof p.author !== "string" || typeof p.course !== "string") throw new Error("The saved portfolio details are damaged.");
  return { author: p.author, course: p.course };
}

function parseProgram(raw: unknown): Program {
  const p = obj(raw, "The saved program");
  for (const k of ["courses", "instructors", "stakeholders"]) {
    if (!Array.isArray(p[k]) || (p[k] as unknown[]).length === 0) throw new Error(`The saved program is missing its ${k}.`);
  }
  if (typeof p.policies !== "object" || p.policies === null) throw new Error("The saved program is missing its policies.");
  const program = { ...p, cancellations: Array.isArray(p.cancellations) ? p.cancellations : [] } as unknown as Program;
  // The real test: can the model analyze it?
  try {
    for (const t of TERMS) analyzeTerm(program, t, DEFAULT_ASSUMPTIONS);
  } catch (err) {
    throw new Error(`The saved program is damaged: ${(err as Error).message}.`);
  }
  return program;
}

// ---- small validators ------------------------------------------------------

function obj(v: unknown, what: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${what} isn't in the expected format.`);
  return v as Record<string, unknown>;
}
function list(r: Record<string, unknown>, k: string): unknown[] {
  if (!Array.isArray(r[k])) throw new Error(`The saved session is missing its ${k}.`);
  return r[k] as unknown[];
}
function int(r: Record<string, unknown>, k: string, min: number): number {
  const v = r[k];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) throw new Error(`The saved session has an invalid ${k}.`);
  return v;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], what: string): T {
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) throw new Error(`The save has an unknown ${what}.`);
  return v as T;
}
