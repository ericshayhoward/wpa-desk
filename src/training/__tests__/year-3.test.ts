import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm } from "../../model";
import { CAST, STANDARD_ARC, scenarioById } from "../../content";
import {
  addEvidence,
  advanceTerm,
  blockingScenarios,
  fillTemplate,
  resolveScenario,
  staffingPlanEvidence,
  startSession,
  unavailableReason,
  type MemoDraft,
  type TrainingSession,
} from "../index";
import { closeOutTerm } from "../../test-fixtures/reports";
import { landed } from "../../test-fixtures/scheduled";

const stipend = scenarioById("gta-stipend")!;
const swap = scenarioById("wc-budget-swap")!;
const handoff = scenarioById("handoff")!;
const only = [stipend, swap, handoff];

const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;
const memo = (audience: MemoDraft["audience"], evidenceIds: string[] = []): MemoDraft => ({
  audience, subject: "S", ask: "A", body: "B", evidenceIds, commitments: [], selfAssessment: {},
});
/** Advances a term, settling the urgent budget swap (split) if it's waiting. */
function next(s: TrainingSession): TrainingSession {
  if (s.inbox.includes("wc-budget-swap")) s = resolveScenario(s, swap, "split", null, CAST).session;
  return advanceTerm(closeOutTerm(s), only, STANDARD_ARC).session;
}
function to(termIndex: number): TrainingSession {
  let s = startSession(MIDLAND_STATE, only, STANDARD_ARC);
  while (s.termIndex < termIndex) s = next(s);
  return s;
}
const decide = (s: TrainingSession, sc: typeof stipend, id: string, m: MemoDraft | null = null) =>
  resolveScenario(s, sc, id, m, CAST);

describe("Fall, Year 3", () => {
  it("brings the stipend campaign and the budget swap to the interim director; only the swap is urgent", () => {
    expect(to(4).inbox).toEqual([]);
    const s = to(5);
    expect(s.stage).toBe("wpa");
    expect(s.inbox).toEqual(["gta-stipend", "wc-budget-swap"]);
    expect(blockingScenarios(s, only).map((x) => x.id)).toEqual(["wc-budget-swap"]);
    expect(s.adminHoursRemaining).toBe(45); // job applications
  });
});

describe("The GTA Stipend Campaign", () => {
  it("states the program's own numbers in the letter", () => {
    const body = fillTemplate(stipend.documents[0]!.body, to(5));
    expect(body).toContain("We are the 15 graduate teaching assistants");
    expect(body).toContain("We are paid $9,000 for each");
    expect(body).toContain("We teach 15 of the program's 60 sections");
  });

  it("signing wins the GTAs and costs the dean, the provost's office, and Dr. Cherry", () => {
    let s = decide(to(5), stipend, "sign-letter").session;
    expect([trust(s, "gta_cohort"), trust(s, "dean"), trust(s, "fyw_director")]).toEqual([58, 49, 58]);
    s = next(s);
    expect(trust(s, "gta_cohort")).toBe(60);
  });

  it("the dean carries a case made with a staffing plan; without one, the GTAs notice you didn't sign", () => {
    let s = to(5);
    const fall = analyzeTerm(s.program, "fall", A);
    s = addEvidence(s, staffingPlanEvidence(s.program, [], fall, fall));
    const withPlan = decide(s, stipend, "advocate-to-dean", memo("dean", [s.evidence[0]!.id]));
    expect(withPlan.outcome.persuaded).toBe(true);
    expect([trust(withPlan.session, "gta_cohort"), trust(withPlan.session, "dean")]).toEqual([55, 58]);

    const without = decide(to(5), stipend, "advocate-to-dean", memo("dean"));
    expect(without.outcome.persuaded).toBe(false);
    expect(trust(without.session, "gta_cohort")).toBe(47);
  });

  it("staying neutral pleases the dean; recusing costs the least with everyone", () => {
    const neutral = decide(to(5), stipend, "stay-neutral").session;
    expect([trust(neutral, "dean"), trust(neutral, "gta_cohort")]).toEqual([58, 44]);
    const recused = decide(to(5), stipend, "recuse").session;
    expect([trust(recused, "chair"), trust(recused, "gta_cohort"), trust(recused, "fyw_director")]).toEqual([62, 49, 62]);
  });
});

describe("The Writing Center Budget Swap", () => {
  // The program's share of the cut is announced for spring.
  const budget = (s: TrainingSession) => landed(s).budgetPerTerm - MIDLAND_STATE.budgetPerTerm;

  it("each answer puts the cut somewhere", () => {
    expect(budget(decide(to(5), swap, "cut-writing-center").session)).toBe(0);
    expect(trust(decide(to(5), swap, "cut-writing-center").session, "writing_center")).toBe(53);
    expect(budget(decide(to(5), swap, "cut-program").session)).toBe(-15000);
    expect(budget(decide(to(5), swap, "split").session)).toBe(-7500);
    const program = decide(to(5), swap, "cut-program").session;
    expect(program.program.budgetPerTerm).toBe(MIDLAND_STATE.budgetPerTerm);
    expect(program.pending.find((p) => p.scenarioId === "wc-budget-swap")).toMatchObject({ dueTerm: 6, announced: true });
  });

  it("a joint plan needs Dr. Raman's trust and a memo, and shrinks the cut", () => {
    const s = to(5);
    const joint = swap.options.find((o) => o.id === "joint-proposal")!;
    expect(unavailableReason(s, joint)).toBeNull();
    expect(() => decide(s, swap, "joint-proposal")).toThrow(/requires a memo/);
    const r = decide(s, swap, "joint-proposal", memo("dean")).session;
    expect(budget(r)).toBe(-8000);
    expect(trust(r, "provost_office")).toBe(53);
    // After protecting the instruction line at the writing center's expense, the joint plan isn't open.
    const cooled = decide(s, swap, "cut-writing-center").session;
    expect(unavailableReason(cooled, joint)).toMatch(/Needs trust of 65/);
  });
});

describe("The Handoff", () => {
  it("arrives in the final term and spends hours the dissertation would otherwise get", () => {
    let s = to(6);
    expect(s.inbox).toContain("handoff");
    const before = s.adminHoursRemaining;
    s = decide(s, handoff, "write-handbook").session;
    expect(s.adminHoursRemaining).toBe(before - 10);
    expect(trust(s, "fyw_director")).toBe(65);
    expect(trust(decide(to(6), handoff, "leave-it").session, "fyw_director")).toBe(57);
  });
});
