import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges } from "../../model";
import { SCENARIOS as ALL_SCENARIOS, scenarioById } from "../../content";

/** Only the scenarios under test; others (e.g., urgent spring scenarios) would interrupt the calendar. */
const SCENARIOS = ALL_SCENARIOS.filter((s) => ["cap-memo", "late-hire"].includes(s.id));
import {
  addEvidence,
  advanceTerm,
  fillTemplate,
  resolveScenario,
  staffingPlanEvidence,
  startSession,
  type MemoDraft,
  type TrainingSession,
} from "../index";

const lateHire = scenarioById("late-hire")!;
const capMemo = scenarioById("cap-memo")!;

const spring = (s: TrainingSession) => analyzeTerm(s.program, "spring", A);
const adjuncts = (s: TrainingSession) => s.program.instructors.find((p) => p.rank === "adjunct")!.headcount;
const next = (s: TrainingSession) => advanceTerm(s, SCENARIOS).session;

/** Fall Y1 with The Cap Memo resolved one way (or left in the inbox), then advance to spring. */
function springAfter(capChoice?: string): TrainingSession {
  let s = startSession(MIDLAND_STATE, SCENARIOS);
  if (capChoice) s = resolveScenario(s, capMemo, capChoice, null).session;
  return next(s);
}

const memo = (evidenceIds: string[]): MemoDraft => ({
  audience: "dean",
  subject: "Emergency hire",
  ask: "Waive the posting period.",
  body: "We need one instructor.",
  evidenceIds,
  commitments: [],
  selfAssessment: {},
});

describe("arrival", () => {
  it("doesn't arrive in fall", () => {
    expect(startSession(MIDLAND_STATE, SCENARIOS).inbox).not.toContain("late-hire");
  });

  it("arrives in spring: three adjuncts leave and three ENGL 102 sections are uncovered", () => {
    const s = springAfter();
    expect(s.inbox).toContain("late-hire");
    expect(adjuncts(s)).toBe(11);
    expect(spring(s).unstaffedSections).toBe(3);
    expect(fillTemplate(lateHire.documents[0]!.body, s)).toContain("no instructor for 3 sections of");
  });

  it("never happens if caps were raised to 27: there's enough slack, so nobody leaves", () => {
    const s = springAfter("accept");
    expect(s.inbox).not.toContain("late-hire");
    expect(adjuncts(s)).toBe(14);
  });

  it("states the real gap: a compromise at 25 leaves only 2 sections uncovered", () => {
    const s = springAfter("compromise-25");
    expect(spring(s).unstaffedSections).toBe(2);
    expect(fillTemplate(lateHire.documents[0]!.body, s)).toContain("no instructor for 2 sections of");
  });

  it("is urgent: the term can't advance until it's resolved", () => {
    expect(() => next(springAfter())).toThrow(/The Late Hire/);
  });
});

describe("options", () => {
  it("emergency hire with a staffing plan attached: the dean approves, the gap closes", () => {
    let s = springAfter();
    const plan = [{ kind: "adjustHeadcount" as const, rank: "adjunct" as const, delta: 1 }];
    s = addEvidence(s, staffingPlanEvidence(s.program, plan, spring(s), analyzeTerm(applyChanges(s.program, plan), "spring", A)));
    const { session, outcome } = resolveScenario(s, lateHire, "emergency-hire", memo([s.evidence[0]!.id]));
    expect(outcome.persuaded).toBe(true);
    expect(adjuncts(session)).toBe(12);
    expect(spring(session).unstaffedSections).toBe(0);
    expect(outcome.impact.comparison.unstaffedSections).toBe(-3);
  });

  it("emergency hire without evidence: still hired, but late", () => {
    const { session, outcome } = resolveScenario(springAfter(), lateHire, "emergency-hire", memo([]));
    expect(outcome.persuaded).toBe(false);
    expect(outcome.missingEvidence).toEqual(["staffing_plan"]);
    expect(spring(session).unstaffedSections).toBe(0);
    expect(session.program.stakeholders.find((x) => x.id === "students")!.trust).toBe(51);
  });

  it("overloads cover two sections; the one left over is cancelled, then restored next term", () => {
    const { session, outcome } = resolveScenario(springAfter(), lateHire, "overloads", null);
    const a = spring(session);
    expect(a.staffing.find((x) => x.rank === "ntt")!.overloadSections).toBe(2);
    expect(a.unstaffedSections).toBe(0);
    expect(a.totalSectionsCancelled).toBe(1);
    expect(a.totalSeatsUnserved).toBe(24);
    expect(outcome.changeDescriptions).toContain("Cancel 1 ENGL102 section (spring)");

    const fall2 = next(session);
    expect(fall2.program.cancellations).toEqual([]);
    expect(fall2.program.instructors.find((p) => p.rank === "ntt")!.overload).toBeUndefined();
  });

  it("overloads after a compromise at 25: the gap is only 2, so nothing is cancelled", () => {
    const { session } = resolveScenario(springAfter("compromise-25"), lateHire, "overloads", null);
    expect(spring(session).totalSectionsCancelled).toBe(0);
    expect(spring(session).unstaffedSections).toBe(0);
  });

  it("adding seats raises the ENGL 102 cap by two for one term", () => {
    const { session } = resolveScenario(springAfter(), lateHire, "add-seats", null);
    expect(session.program.policies.caps.ENGL102).toBe(26);
    expect(spring(session).unstaffedSections).toBe(0);
    expect(spring(session).totalSeatsUnserved).toBe(0);
    expect(next(session).program.policies.caps.ENGL102).toBe(24);
  });

  it("cancelling removes exactly the uncovered sections", () => {
    const { session } = resolveScenario(springAfter(), lateHire, "cancel", null);
    expect(spring(session).totalSectionsCancelled).toBe(3);
    expect(spring(session).totalSeatsUnserved).toBe(72);
    expect(spring(session).unstaffedSections).toBe(0);
  });
});
