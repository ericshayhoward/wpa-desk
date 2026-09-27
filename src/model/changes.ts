import type { Program, Rank, StakeholderId, Term } from "./types";
import { STAFFING_ORDER, STAKEHOLDER_IDS, TERMS } from "./types";

/**
 * A proposed change to a program. Scenario effects and what-if tools both
 * speak this vocabulary, so the model never needs to know which one asked.
 */
export type ProgramChange =
  | { kind: "setCap"; courseId: string | "all"; cap: number }
  | { kind: "scaleSeatDemand"; courseId: string | "all"; factor: number; terms?: Term[] }
  | { kind: "adjustHeadcount"; rank: Rank; delta: number }
  | { kind: "setCostPerSection"; rank: Rank; cost: number }
  | { kind: "setBudget"; budgetPerTerm: number }
  | { kind: "adjustBudget"; delta: number }
  | { kind: "adjustMorale"; rank: Rank; delta: number }
  | { kind: "adjustTrust"; stakeholder: StakeholderId; delta: number }
  | { kind: "adjustPoliticalCapital"; delta: number };

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
    default:
      throw new Error(`${where}: unknown change kind "${String(r.kind)}"`);
  }
}
