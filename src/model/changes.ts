import type { Policies, Program, Rank, StakeholderId, Term } from "./types";
import { RANK_LABELS } from "./types";
import { STAFFING_ORDER, STAKEHOLDER_IDS, TERMS } from "./types";

/**
 * A proposed change to a program. Scenario effects and what-if tools both
 * speak this vocabulary, so the model never needs to know which one asked.
 */
export type ProgramChange =
  | { kind: "setCap"; courseId: string | "all"; cap: number }
  /** Raises or lowers a cap relative to whatever it is now (composes with other decisions). */
  | { kind: "adjustCap"; courseId: string | "all"; delta: number }
  | { kind: "scaleSeatDemand"; courseId: string | "all"; factor: number; terms?: Term[] }
  | { kind: "adjustHeadcount"; rank: Rank; delta: number }
  | { kind: "setCostPerSection"; rank: Rank; cost: number }
  | { kind: "setSectionsPerTerm"; rank: Rank; sections: number }
  | { kind: "setOverload"; rank: Rank; maxPerPerson: number; costPerSection: number }
  /** Sets how many sections of a course are cancelled in a term (0 restores them). */
  | { kind: "cancelSections"; courseId: string; term: Term; sections: number }
  | { kind: "setBudget"; budgetPerTerm: number }
  | { kind: "adjustBudget"; delta: number }
  | { kind: "adjustMorale"; rank: Rank; delta: number }
  | { kind: "adjustTrust"; stakeholder: StakeholderId; delta: number }
  | { kind: "adjustPoliticalCapital"; delta: number }
  | PolicyChange;

/** Sets one program policy (every policy except caps, which have their own changes). */
export type PolicyChange =
  | { kind: "setPolicy"; policy: BooleanPolicy; value: boolean }
  | { kind: "setPolicy"; policy: "placement"; value: Policies["placement"] }
  | { kind: "setPolicy"; policy: "aiPolicy"; value: Policies["aiPolicy"] };

/** Program policies that are simply on or off. */
export type BooleanPolicy = "commonSyllabus" | "portfolioAssessment";
export const BOOLEAN_POLICIES: readonly BooleanPolicy[] = ["commonSyllabus", "portfolioAssessment"];

/** Allowed values for the policies that choose among options. */
export const POLICY_VALUES = {
  placement: ["test_scores", "directed_self_placement", "multiple_measures"],
  aiPolicy: ["none", "instructor_choice", "program_guidance", "detector"],
} as const satisfies { [K in "placement" | "aiPolicy"]: readonly Policies[K][] };

const POLICY_LABELS: Record<PolicyChange["policy"], string> = {
  commonSyllabus: "Common syllabus",
  portfolioAssessment: "Program-wide portfolio assessment",
  placement: "Placement",
  aiPolicy: "AI policy",
};

const VALUE_LABELS: Record<string, string> = {
  test_scores: "test scores",
  directed_self_placement: "directed self-placement",
  multiple_measures: "multiple measures",
  none: "none",
  instructor_choice: "each instructor's choice",
  program_guidance: "program guidance",
  detector: "AI detection software",
};

function policyValueLabel(v: boolean | string): string {
  return typeof v === "boolean" ? (v ? "yes" : "no") : (VALUE_LABELS[v] ?? v);
}

/** Returns a new program with the changes applied in order. The input is never mutated. */
export function applyChanges(program: Program, changes: ProgramChange[]): Program {
  const next: Program = JSON.parse(JSON.stringify(program));
  for (const change of changes) applyOne(next, change);
  return next;
}

function applyOne(p: Program, change: ProgramChange): void {
  switch (change.kind) {
    case "setCap": {
      if (!Number.isInteger(change.cap) || change.cap < 1) throw new Error(`Invalid cap: ${change.cap}`);
      for (const id of courseIds(p, change.courseId)) p.policies.caps[id] = change.cap;
      return;
    }
    case "adjustCap": {
      for (const id of courseIds(p, change.courseId)) {
        p.policies.caps[id] = Math.max(1, Math.round((p.policies.caps[id] ?? 1) + change.delta));
      }
      return;
    }
    case "scaleSeatDemand": {
      if (change.factor < 0) throw new Error(`Invalid demand factor: ${change.factor}`);
      const terms = change.terms ?? TERMS;
      for (const id of courseIds(p, change.courseId)) {
        const course = p.courses.find((c) => c.id === id)!;
        for (const t of terms) course.seatDemand[t] = Math.round(course.seatDemand[t] * change.factor);
      }
      return;
    }
    case "adjustHeadcount": {
      const pool = findPool(p, change.rank);
      pool.headcount = Math.max(0, pool.headcount + change.delta);
      return;
    }
    case "setCostPerSection": {
      if (change.cost < 0) throw new Error(`Invalid cost: ${change.cost}`);
      findPool(p, change.rank).costPerSection = change.cost;
      return;
    }
    case "setSectionsPerTerm": {
      if (!Number.isInteger(change.sections) || change.sections < 0) throw new Error(`Invalid load: ${change.sections}`);
      findPool(p, change.rank).sectionsPerTerm = change.sections;
      return;
    }
    case "setOverload": {
      if (!Number.isInteger(change.maxPerPerson) || change.maxPerPerson < 0 || change.costPerSection < 0) {
        throw new Error(`Invalid overload for ${change.rank}`);
      }
      const pool = findPool(p, change.rank);
      if (change.maxPerPerson === 0) delete pool.overload;
      else pool.overload = { maxPerPerson: change.maxPerPerson, costPerSection: change.costPerSection };
      return;
    }
    case "cancelSections": {
      if (!Number.isInteger(change.sections) || change.sections < 0) throw new Error(`Invalid cancellation: ${change.sections}`);
      const [id] = courseIds(p, change.courseId);
      p.cancellations = (p.cancellations ?? []).filter((x) => !(x.courseId === id && x.term === change.term));
      if (change.sections > 0) p.cancellations.push({ courseId: id!, term: change.term, sections: change.sections });
      return;
    }
    case "setBudget": {
      p.budgetPerTerm = Math.max(0, change.budgetPerTerm);
      return;
    }
    case "adjustBudget": {
      p.budgetPerTerm = Math.max(0, p.budgetPerTerm + change.delta);
      return;
    }
    case "adjustMorale": {
      const pool = findPool(p, change.rank);
      pool.morale = Math.min(100, Math.max(0, pool.morale + change.delta));
      return;
    }
    case "adjustTrust": {
      const s = p.stakeholders.find((x) => x.id === change.stakeholder);
      if (!s) throw new Error(`Unknown stakeholder: ${change.stakeholder}`);
      s.trust = Math.min(100, Math.max(0, s.trust + change.delta));
      return;
    }
    case "adjustPoliticalCapital": {
      p.politicalCapital = Math.max(0, p.politicalCapital + change.delta);
      return;
    }
    case "setPolicy": {
      (p.policies as unknown as Record<string, unknown>)[change.policy] = change.value;
      return;
    }
  }
}

function courseIds(p: Program, courseId: string): string[] {
  if (courseId === "all") return p.courses.map((c) => c.id);
  if (!p.courses.some((c) => c.id === courseId)) throw new Error(`Unknown course: ${courseId}`);
  return [courseId];
}

function findPool(p: Program, rank: Rank) {
  const pool = p.instructors.find((x) => x.rank === rank);
  if (!pool) throw new Error(`No instructor pool for rank: ${rank}`);
  return pool;
}

// ---------------------------------------------------------------------------
// Validation for changes that arrive from content files (scenarios, imports)
// ---------------------------------------------------------------------------

/** Checks an untyped value and returns it as a ProgramChange, or throws with a readable message. */
export function parseChange(raw: unknown, where = "change"): ProgramChange {
  if (typeof raw !== "object" || raw === null) throw new Error(`${where}: expected an object`);
  const r = raw as Record<string, unknown>;
  const num = (k: string) => {
    if (typeof r[k] !== "number" || !Number.isFinite(r[k])) throw new Error(`${where}: "${k}" must be a number`);
    return r[k] as number;
  };
  const str = (k: string) => {
    if (typeof r[k] !== "string") throw new Error(`${where}: "${k}" must be a string`);
    return r[k] as string;
  };
  const rank = () => {
    const v = str("rank");
    if (!(STAFFING_ORDER as readonly string[]).includes(v)) throw new Error(`${where}: unknown rank "${v}"`);
    return v as Rank;
  };
  switch (r.kind) {
    case "setCap":
      return { kind: "setCap", courseId: str("courseId"), cap: num("cap") };
    case "adjustCap":
      return { kind: "adjustCap", courseId: str("courseId"), delta: num("delta") };
    case "scaleSeatDemand": {
      const terms = r.terms;
      if (terms !== undefined && !(Array.isArray(terms) && terms.every((t) => (TERMS as readonly unknown[]).includes(t)))) {
        throw new Error(`${where}: "terms" must be a list of fall/spring`);
      }
      return { kind: "scaleSeatDemand", courseId: str("courseId"), factor: num("factor"), terms: terms as Term[] | undefined };
    }
    case "adjustHeadcount":
      return { kind: "adjustHeadcount", rank: rank(), delta: num("delta") };
    case "setCostPerSection":
      return { kind: "setCostPerSection", rank: rank(), cost: num("cost") };
    case "setSectionsPerTerm":
      return { kind: "setSectionsPerTerm", rank: rank(), sections: num("sections") };
    case "setOverload":
      return { kind: "setOverload", rank: rank(), maxPerPerson: num("maxPerPerson"), costPerSection: num("costPerSection") };
    case "cancelSections": {
      const term = str("term");
      if (!(TERMS as readonly string[]).includes(term)) throw new Error(`${where}: "term" must be fall or spring`);
      return { kind: "cancelSections", courseId: str("courseId"), term: term as Term, sections: num("sections") };
    }
    case "setBudget":
      return { kind: "setBudget", budgetPerTerm: num("budgetPerTerm") };
    case "adjustBudget":
      return { kind: "adjustBudget", delta: num("delta") };
    case "adjustMorale":
      return { kind: "adjustMorale", rank: rank(), delta: num("delta") };
    case "adjustTrust": {
      const s = str("stakeholder");
      if (!(STAKEHOLDER_IDS as readonly string[]).includes(s)) throw new Error(`${where}: unknown stakeholder "${s}"`);
      return { kind: "adjustTrust", stakeholder: s as StakeholderId, delta: num("delta") };
    }
    case "adjustPoliticalCapital":
      return { kind: "adjustPoliticalCapital", delta: num("delta") };
    case "setPolicy": {
      const policy = str("policy");
      if ((BOOLEAN_POLICIES as readonly string[]).includes(policy)) {
        if (typeof r.value !== "boolean") throw new Error(`${where}: "value" must be true or false`);
        return { kind: "setPolicy", policy: policy as BooleanPolicy, value: r.value };
      }
      if (policy === "placement" || policy === "aiPolicy") {
        const allowed: readonly string[] = POLICY_VALUES[policy];
        if (typeof r.value !== "string" || !allowed.includes(r.value)) {
          throw new Error(`${where}: "value" for ${policy} must be one of ${allowed.join(", ")}`);
        }
        return { kind: "setPolicy", policy, value: r.value } as PolicyChange;
      }
      throw new Error(`${where}: "policy" must be one of ${[...BOOLEAN_POLICIES, "placement", "aiPolicy"].join(", ")}`);
    }
    default:
      throw new Error(`${where}: unknown change kind "${String(r.kind)}"`);
  }
}

// ---------------------------------------------------------------------------
// Plain-language descriptions
// ---------------------------------------------------------------------------

/** Describes a change relative to the program it would be applied to. */
export function describeChange(program: Program, change: ProgramChange): string {
  const pool = (rank: Rank) => program.instructors.find((p) => p.rank === rank);
  const label = (rank: Rank) => RANK_LABELS[rank].toLowerCase();
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  switch (change.kind) {
    case "setCap":
      return change.courseId === "all"
        ? `All caps → ${change.cap}`
        : `${change.courseId} cap ${program.policies.caps[change.courseId]} → ${change.cap}`;
    case "adjustCap":
      return change.courseId === "all"
        ? `All caps ${change.delta >= 0 ? "+" : "−"}${Math.abs(change.delta)}`
        : `${change.courseId} cap ${program.policies.caps[change.courseId]} → ${Math.max(
            1,
            (program.policies.caps[change.courseId] ?? 1) + change.delta,
          )}`;
    case "scaleSeatDemand":
      return `${change.courseId === "all" ? "Seat demand" : `${change.courseId} demand`} × ${change.factor}`;
    case "adjustHeadcount": {
      const n = Math.abs(change.delta);
      return `${change.delta >= 0 ? "Add" : "Lose"} ${n} ${label(change.rank)} (${pool(change.rank)?.headcount ?? 0} → ${Math.max(
        0,
        (pool(change.rank)?.headcount ?? 0) + change.delta,
      )})`;
    }
    case "setCostPerSection":
      return `${RANK_LABELS[change.rank]} pay per section ${money(pool(change.rank)?.costPerSection ?? 0)} → ${money(change.cost)}`;
    case "setSectionsPerTerm":
      return `${RANK_LABELS[change.rank]} load ${pool(change.rank)?.sectionsPerTerm ?? 0} → ${change.sections} sections per person`;
    case "setOverload":
      return change.maxPerPerson === 0
        ? `No overloads for ${label(change.rank)}`
        : `Up to ${change.maxPerPerson} overload section${change.maxPerPerson === 1 ? "" : "s"} per person for ${label(
            change.rank,
          )} at ${money(change.costPerSection)}`;
    case "cancelSections":
      return change.sections === 0
        ? `Restore all ${change.courseId} sections (${change.term})`
        : `Cancel ${change.sections} ${change.courseId} section${change.sections === 1 ? "" : "s"} (${change.term})`;
    case "setBudget":
      return `Instruction budget → ${money(change.budgetPerTerm)} per term`;
    case "adjustBudget":
      return `Instruction budget ${change.delta >= 0 ? "+" : "−"}${money(Math.abs(change.delta))} per term`;
    case "adjustMorale":
      return `${RANK_LABELS[change.rank]} morale ${change.delta >= 0 ? "+" : "−"}${Math.abs(change.delta)}`;
    case "adjustTrust":
      return `${program.stakeholders.find((x) => x.id === change.stakeholder)?.name ?? change.stakeholder} trust ${
        change.delta >= 0 ? "+" : "−"
      }${Math.abs(change.delta)}`;
    case "adjustPoliticalCapital":
      return `Political capital ${change.delta >= 0 ? "+" : "−"}${Math.abs(change.delta)}`;
    case "setPolicy":
      return `${POLICY_LABELS[change.policy]}: ${policyValueLabel(program.policies[change.policy])} → ${policyValueLabel(change.value)}`;
  }
}
