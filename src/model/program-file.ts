/**
 * Programs someone enters (by hand or from a file): validation, local
 * assumptions, and the program file format, which is separate from game
 * saves. Input is untrusted, so every problem names the field it's about,
 * in words for a person and as a path for someone editing the file.
 */
import { ASSUMPTION_IDS, ASSUMPTION_LIMITS, DEFAULT_ASSUMPTIONS } from "./assumptions";
import { POLICY_VALUES } from "./changes";
import type {
  AssumptionId,
  Assumptions,
  Cancellation,
  Course,
  InstructorPool,
  Policies,
  Program,
  Stakeholder,
  Term,
} from "./types";
import { COURSE_KINDS, RANK_LABELS, STAFFING_ORDER, STAKEHOLDER_IDS, TERMS } from "./types";

export interface FieldIssue {
  /** Where the value sits, e.g. "courses[1].seatDemand.fall". */
  path: string;
  /** The field in words, e.g. "Course 2 (ENGL102), fall seats needed". */
  field: string;
  /** What's wrong, as a clause: "must be a whole number, 0 or more". */
  problem: string;
  /** Extra help for someone editing the file by hand. */
  fileHint?: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; issues: FieldIssue[] };

/** One issue as a sentence naming the field and its path: "Budget per term: needs a value (budgetPerTerm)." */
export function issueText(issue: FieldIssue, prefix = ""): string {
  const path = [prefix, issue.path].filter(Boolean).join(".") || "the whole file";
  return `${issue.field}: ${issue.problem}${issue.fileHint ? ` ${issue.fileHint}` : ""} (${path}).`;
}

function throwFirst(issues: FieldIssue[], prefix = ""): never {
  const more = issues.length - 1;
  throw new Error(issueText(issues[0]!, prefix) + (more > 0 ? ` ${more} more problem${more === 1 ? "" : "s"} after this one.` : ""));
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

/** Used when a program file leaves out its id. */
export const ENTERED_PROGRAM_ID = "your-program";

/**
 * Checks a program and returns every problem found, or the program with
 * defaults filled in. Only what the planning tools use is required; the
 * game-only fields (morale, stakeholders, political capital, policies other
 * than caps) are optional, with neutral defaults.
 */
export function checkProgram(raw: unknown): Checked<Program> {
  const c = new Checker();
  const p = c.obj(raw, "", "The program");
  if (!p) return c.result<Program>(null);

  const id = p.id === undefined ? ENTERED_PROGRAM_ID : c.text(p.id, "id", "Program id", true);
  const institution = c.text(p.institution, "institution", "Institution name", true);
  const description = p.description === undefined ? "" : c.text(p.description, "description", "Description", false);
  const fictional = p.fictional === undefined ? false : c.bool(p.fictional, "fictional", "Sample program flag");
  const undergraduateEnrollment =
    p.undergraduateEnrollment === undefined
      ? 0
      : c.num(p.undergraduateEnrollment, "undergraduateEnrollment", "Undergraduate enrollment", { min: 0, whole: true });

  const policies = p.policies === undefined ? undefined : c.obj(p.policies, "policies", "Policies");
  const capsRaw =
    policies === null ? null : policies?.caps === undefined ? c.missing("policies.caps", "Caps") : c.obj(policies.caps, "policies.caps", "Caps");

  // ---- Courses, each with its cap ----
  const courses: Course[] = [];
  const caps: Record<string, number> = {};
  if (!Array.isArray(p.courses)) {
    c.add("courses", "Courses", p.courses === undefined ? "are missing" : "must be a list");
  } else if (p.courses.length === 0) {
    c.add("courses", "Courses", "need at least one course");
  } else {
    p.courses.forEach((rawCourse, i) => {
      const at = `courses[${i}]`;
      const code = (rawCourse as { id?: unknown } | null)?.id;
      const name = `Course ${i + 1}${typeof code === "string" && code.trim() ? ` (${code.trim()})` : ""}`;
      const r = c.obj(rawCourse, at, name);
      if (!r) return;
      const courseId = c.text(r.id, `${at}.id`, `${name}, course code`, true);
      if (courseId && courses.some((x) => x.id === courseId)) {
        c.add(`${at}.id`, `${name}, course code`, "is the same as another course's");
      }
      const demand = c.obj(r.seatDemand, `${at}.seatDemand`, `${name}, seats needed`);
      courses.push({
        id: courseId,
        title: c.text(r.title, `${at}.title`, `${name}, title`, true),
        kind: c.oneOf(r.kind, COURSE_KINDS, `${at}.kind`, `${name}, kind`),
        credits: c.num(r.credits, `${at}.credits`, `${name}, credits`, { min: 0 }),
        seatDemand: {
          fall: demand ? c.num(demand.fall, `${at}.seatDemand.fall`, `${name}, fall seats needed`, { min: 0, whole: true }) : NaN,
          spring: demand ? c.num(demand.spring, `${at}.seatDemand.spring`, `${name}, spring seats needed`, { min: 0, whole: true }) : NaN,
        },
        baselineDfw: c.num(r.baselineDfw, `${at}.baselineDfw`, `${name}, D/F/W rate`, { min: 0, max: 1, percent: true }),
        baselineSectionSize: c.num(r.baselineSectionSize, `${at}.baselineSectionSize`, `${name}, average section size when D/F/W was observed`, {
          above: 0,
        }),
      });
      if (courseId && capsRaw) {
        caps[courseId] = c.num(capsRaw[courseId], capPath(courseId), `${name}, cap`, { min: 1, whole: true });
      }
    });
  }
  if (capsRaw) {
    for (const k of Object.keys(capsRaw)) {
      if (!courses.some((x) => x.id === k)) c.add(`policies.caps${key(k)}`, `Cap for ${k}`, "doesn't belong to any course");
    }
  }

  const policy = <K extends "placement" | "aiPolicy">(k: K, fallback: Policies[K]): Policies[K] =>
    policies?.[k] === undefined ? fallback : c.oneOf(policies[k], POLICY_VALUES[k] as readonly string[] as readonly Policies[K][], `policies.${k}`, `Policies, ${k}`);
  const flag = (k: "commonSyllabus" | "portfolioAssessment") =>
    policies?.[k] === undefined ? false : c.bool(policies[k], `policies.${k}`, `Policies, ${k}`);

  // ---- Instructor groups ----
  const instructors: InstructorPool[] = [];
  const rawPools = p.instructors === undefined ? [] : p.instructors;
  if (!Array.isArray(rawPools)) {
    c.add("instructors", "Instructor groups", "must be a list");
  } else {
    rawPools.forEach((rawPool, i) => {
      const at = `instructors[${i}]`;
      const r = c.obj(rawPool, at, `Instructor group ${i + 1}`);
      if (!r) return;
      const rank = c.oneOf(r.rank, STAFFING_ORDER, `${at}.rank`, `Instructor group ${i + 1}, rank`);
      const name = RANK_LABELS[rank] ?? `Instructor group ${i + 1}`;
      if (rank && instructors.some((x) => x.rank === rank)) c.add(`${at}.rank`, name, "are listed twice");
      let overload: InstructorPool["overload"];
      if (r.overload !== undefined) {
        const o = c.obj(r.overload, `${at}.overload`, `${name}, overloads`);
        overload = {
          maxPerPerson: o ? c.num(o.maxPerPerson, `${at}.overload.maxPerPerson`, `${name}, overloads per person`, { min: 0, whole: true }) : NaN,
          costPerSection: o ? c.num(o.costPerSection, `${at}.overload.costPerSection`, `${name}, overload pay per section`, { min: 0 }) : NaN,
        };
      }
      const note = r.note === undefined ? undefined : c.text(r.note, `${at}.note`, `${name}, note`, false);
      instructors.push({
        rank,
        headcount: c.num(r.headcount, `${at}.headcount`, `${name}, people`, { min: 0, whole: true }),
        sectionsPerTerm: c.num(r.sectionsPerTerm, `${at}.sectionsPerTerm`, `${name}, sections each per term`, { min: 0, whole: true }),
        costPerSection: c.num(r.costPerSection, `${at}.costPerSection`, `${name}, pay per section`, { min: 0 }),
        paidBy: c.oneOf(r.paidBy, ["program", "department"] as const, `${at}.paidBy`, `${name}, who pays`),
        morale: r.morale === undefined ? 50 : c.num(r.morale, `${at}.morale`, `${name}, morale`, { min: 0, max: 100 }),
        ...(overload && { overload }),
        ...(note?.trim() && { note: note.trim() }),
      });
    });
  }

  // ---- Budget ----
  const budgetPerTerm = c.num(p.budgetPerTerm, "budgetPerTerm", "Budget per term", { min: 0 });
  let budgetByTerm: Program["budgetByTerm"];
  if (p.budgetByTerm !== undefined) {
    const b = c.obj(p.budgetByTerm, "budgetByTerm", "One-term budget changes");
    if (b) {
      budgetByTerm = {};
      for (const [t, v] of Object.entries(b)) {
        if (!(TERMS as readonly string[]).includes(t)) c.add(`budgetByTerm${key(t)}`, `One-term budget change for ${t}`, "isn't for fall or spring");
        else budgetByTerm[t as Term] = c.num(v, `budgetByTerm.${t}`, `One-term budget change for ${t}`, {});
      }
    }
  }

  // ---- Game-only fields, optional here ----
  const cancellations: Cancellation[] = [];
  if (p.cancellations !== undefined) {
    if (!Array.isArray(p.cancellations)) c.add("cancellations", "Cancelled sections", "must be a list");
    else
      p.cancellations.forEach((rawCancel, i) => {
        const at = `cancellations[${i}]`;
        const r = c.obj(rawCancel, at, `Cancellation ${i + 1}`);
        if (!r) return;
        const courseId = c.text(r.courseId, `${at}.courseId`, `Cancellation ${i + 1}, course code`, true);
        if (courseId && !courses.some((x) => x.id === courseId)) c.add(`${at}.courseId`, `Cancellation ${i + 1}, course code`, "doesn't match any course");
        cancellations.push({
          courseId,
          term: c.oneOf(r.term, TERMS, `${at}.term`, `Cancellation ${i + 1}, term`),
          sections: c.num(r.sections, `${at}.sections`, `Cancellation ${i + 1}, sections`, { min: 0, whole: true }),
        });
      });
  }
  const stakeholders: Stakeholder[] = [];
  if (p.stakeholders !== undefined) {
    if (!Array.isArray(p.stakeholders)) c.add("stakeholders", "Stakeholders", "must be a list");
    else
      p.stakeholders.forEach((rawPerson, i) => {
        const at = `stakeholders[${i}]`;
        const r = c.obj(rawPerson, at, `Stakeholder ${i + 1}`);
        if (!r) return;
        const priorities = r.priorities === undefined ? [] : r.priorities;
        if (!Array.isArray(priorities) || !priorities.every((x) => typeof x === "string")) {
          c.add(`${at}.priorities`, `Stakeholder ${i + 1}, priorities`, "must be a list of text");
        }
        stakeholders.push({
          id: c.oneOf(r.id, STAKEHOLDER_IDS, `${at}.id`, `Stakeholder ${i + 1}, id`),
          name: c.text(r.name, `${at}.name`, `Stakeholder ${i + 1}, name`, true),
          trust: c.num(r.trust, `${at}.trust`, `Stakeholder ${i + 1}, trust`, { min: 0, max: 100 }),
          priorities: Array.isArray(priorities) ? (priorities as string[]) : [],
        });
      });
  }
  const politicalCapital = p.politicalCapital === undefined ? 0 : c.num(p.politicalCapital, "politicalCapital", "Political capital", {});

  return c.result({
    id,
    institution: institution.trim(),
    description,
    fictional,
    undergraduateEnrollment,
    courses,
    instructors,
    policies: {
      caps,
      placement: policy("placement", "test_scores"),
      commonSyllabus: flag("commonSyllabus"),
      aiPolicy: policy("aiPolicy", "instructor_choice"),
      portfolioAssessment: flag("portfolioAssessment"),
    },
    budgetPerTerm,
    ...(budgetByTerm && { budgetByTerm }),
    cancellations,
    stakeholders,
    politicalCapital,
  });
}

/** Validates a program. Throws with the first problem, naming the field and its path. */
export function parseProgram(raw: unknown): Program {
  const r = checkProgram(raw);
  if (!r.ok) throwFirst(r.issues);
  return r.value;
}

// ---------------------------------------------------------------------------
// Local assumptions
// ---------------------------------------------------------------------------

/** A program's own numbers for one assumption, replacing the default's. */
export interface LocalAssumption {
  value: number;
  low: number;
  high: number;
  /** Where the numbers come from (a local study, an institutional report). */
  source?: string;
}

export type LocalAssumptions = Partial<Record<AssumptionId, LocalAssumption>>;

/**
 * Checks local assumptions: each must be one the model uses, within
 * ASSUMPTION_LIMITS, with the value inside a real range (low below high),
 * so projections keep reporting ranges.
 */
export function checkLocalAssumptions(raw: unknown): Checked<LocalAssumptions> {
  const c = new Checker();
  const r = c.obj(raw, "", "Local assumptions");
  if (!r) return c.result<LocalAssumptions>(null);
  const out: LocalAssumptions = {};
  for (const [id, rawLocal] of Object.entries(r)) {
    if (!(ASSUMPTION_IDS as string[]).includes(id)) {
      c.add(key(id).replace(/^\./, ""), `Assumption "${id}"`, "isn't one the planning tools use");
      continue;
    }
    const def = DEFAULT_ASSUMPTIONS[id as AssumptionId];
    const limits = ASSUMPTION_LIMITS[id as AssumptionId];
    const l = c.obj(rawLocal, id, def.label);
    if (!l) continue;
    const before = c.count;
    const value = c.num(l.value, `${id}.value`, `${def.label}, value`, limits);
    const low = c.num(l.low, `${id}.low`, `${def.label}, low end`, limits);
    const high = c.num(l.high, `${id}.high`, `${def.label}, high end`, limits);
    if (c.count === before) {
      if (low >= high) c.add(`${id}.high`, `${def.label}, high end`, "must be above the low end, so projections show a range");
      else if (value < low || value > high) c.add(`${id}.value`, `${def.label}, value`, "must be between the low and high ends");
    }
    const source = l.source === undefined ? undefined : c.text(l.source, `${id}.source`, `${def.label}, source`, false);
    out[id as AssumptionId] = { value, low, high, ...(source?.trim() && { source: source.trim() }) };
  }
  return c.result(out);
}

/** The defaults with a program's own numbers in place, each marked "local-data". */
export function withLocalAssumptions(base: Assumptions, local: LocalAssumptions): Assumptions {
  const out = { ...base };
  for (const id of ASSUMPTION_IDS) {
    const l = local[id];
    if (!l) continue;
    out[id] = {
      ...base[id],
      value: l.value,
      low: l.low,
      high: l.high,
      confidence: "local-data",
      sources: [l.source ?? "Entered for this program"],
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Program files
// ---------------------------------------------------------------------------

export const PROGRAM_FORMAT = "wpa-desk-program";
/** Bump when the file's shape changes, and add a migration in parseProgramFile. */
export const PROGRAM_VERSION = 1;

export interface ProgramFile {
  format: typeof PROGRAM_FORMAT;
  version: number;
  savedAt: string;
  program: Program;
  /** The program's own assumption values, by id; the rest use the defaults. */
  assumptions: LocalAssumptions;
}

/** Wraps a program and its local assumptions in a versioned file. `savedAt` is passed in to keep this pure. */
export function createProgramFile(program: Program, assumptions: LocalAssumptions, savedAt: Date): ProgramFile {
  return {
    format: PROGRAM_FORMAT,
    version: PROGRAM_VERSION,
    savedAt: savedAt.toISOString(),
    program: JSON.parse(JSON.stringify(program)),
    assumptions: JSON.parse(JSON.stringify(assumptions)),
  };
}

/** Validates a program file from storage or an import. Throws with a message a person can act on. */
export function parseProgramFile(raw: unknown): ProgramFile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw) || (raw as Record<string, unknown>).format !== PROGRAM_FORMAT) {
    throw new Error("This isn't a WPA Desk program file.");
  }
  const f = raw as Record<string, unknown>;
  if (typeof f.version !== "number" || !Number.isInteger(f.version)) throw new Error("The program file has no version number.");
  if (f.version > PROGRAM_VERSION) {
    throw new Error("This program file was made by a newer version of WPA Desk. Update the app to open it.");
  }
  if (f.version < 1) throw new Error(`The program file has an unknown version (${f.version}).`);
  // Migrations from older versions go here, before the checks below.

  const program = checkProgram(f.program);
  if (!program.ok) throwFirst(program.issues, "program");
  const assumptions = checkLocalAssumptions(f.assumptions ?? {});
  if (!assumptions.ok) throwFirst(assumptions.issues, "assumptions");
  return {
    format: PROGRAM_FORMAT,
    version: PROGRAM_VERSION,
    savedAt: typeof f.savedAt === "string" ? f.savedAt : new Date(0).toISOString(),
    program: program.value,
    assumptions: assumptions.value,
  };
}

// ---------------------------------------------------------------------------

interface NumRule {
  min?: number;
  max?: number;
  /** Must be greater than this (for sizes, where 0 makes no sense). */
  above?: number;
  whole?: boolean;
  /** Stored as a fraction, shown and entered as a percentage. */
  percent?: boolean;
}

/** Collects issues. Each check returns a placeholder on failure, so the caller can keep going and report everything. */
class Checker {
  private issues: FieldIssue[] = [];

  get count(): number {
    return this.issues.length;
  }

  add(path: string, field: string, problem: string, fileHint?: string): void {
    this.issues.push({ path, field, problem, ...(fileHint && { fileHint }) });
  }

  result<T>(value: T | null): Checked<T> {
    return this.issues.length > 0 || value === null ? { ok: false, issues: this.issues } : { ok: true, value };
  }

  missing(path: string, field: string): null {
    this.add(path, field, "are missing");
    return null;
  }

  obj(v: unknown, path: string, field: string): Record<string, unknown> | null {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
    this.add(path, field, v === undefined ? "is missing" : "isn't in the expected format");
    return null;
  }

  text(v: unknown, path: string, field: string, required: boolean): string {
    if (typeof v !== "string") {
      this.add(path, field, v === undefined || v === null ? "needs a value" : "must be text");
      return "";
    }
    if (required && v.trim() === "") this.add(path, field, "needs a value");
    return v;
  }

  bool(v: unknown, path: string, field: string): boolean {
    if (typeof v !== "boolean") this.add(path, field, "must be true or false");
    return v === true;
  }

  oneOf<T extends string>(v: unknown, allowed: readonly T[], path: string, field: string): T {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) return v as T;
    this.add(path, field, v === undefined ? "needs a value" : `must be one of: ${allowed.join(", ")}`);
    return undefined as unknown as T;
  }

  num(v: unknown, path: string, field: string, rule: NumRule): number {
    if (v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v))) {
      this.add(path, field, "needs a value");
      return NaN;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) {
      this.add(path, field, "must be a number");
      return NaN;
    }
    const { min, max, above, whole, percent } = rule;
    const fits =
      (!whole || Number.isInteger(v)) &&
      (min === undefined || v >= min) &&
      (max === undefined || v <= max) &&
      (above === undefined || v > above);
    if (!fits) {
      if (percent) this.add(path, field, `must be from ${min! * 100}% to ${max! * 100}%`, "(as a fraction: 0.18 means 18%)");
      else this.add(path, field, rangeProblem(rule));
    }
    return v;
  }
}

function rangeProblem({ min, max, above, whole }: NumRule): string {
  const kind = whole ? "a whole number" : "a number";
  if (above !== undefined) return `must be ${kind} above ${above}`;
  if (min !== undefined && max !== undefined) return `must be ${kind} from ${min} to ${max}`;
  if (min !== undefined) return `must be ${kind}, ${min} or more`;
  return `must be ${kind}`;
}

/** Where a course's cap sits in a program: "policies.caps.ENGL101". */
export function capPath(courseId: string): string {
  return `policies.caps${key(courseId)}`;
}

/** A path step for an object key: ".ENGL101", or ["ENGL 101"] when the key isn't a plain name. */
function key(k: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? `.${k}` : `[${JSON.stringify(k)}]`;
}
