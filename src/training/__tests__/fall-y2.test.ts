import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm } from "../../model";
import { CAST, STANDARD_ARC, scenarioById } from "../../content";
import {
  addEvidence,
  advanceTerm,
  blockingScenarios,
  capAnalysisEvidence,
  fillTemplate,
  resolveScenario,
  staffingPlanEvidence,
  startSession,
  unavailableReason,
  type MemoDraft,
  type TrainingSession,
} from "../index";
import { submitDueReport } from "../../test-fixtures/reports";

const accreditation = scenarioById("accreditation-ask")!;
const dual = scenarioById("dual-enrollment")!;
const only = [accreditation, dual];

const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;
const balance = (s: TrainingSession, term: "fall" | "spring") => analyzeTerm(s.program, term, A).budgetBalance;
const next = (s: TrainingSession) => advanceTerm(submitDueReport(s), only, STANDARD_ARC).session;
/** Fall, Year 2 with nothing else decided. */
const fallY2 = () => next(next(startSession(MIDLAND_STATE, only, STANDARD_ARC)));

const memo = (audience: MemoDraft["audience"], evidenceIds: string[] = []): MemoDraft => ({
  audience,
  subject: "S",
  ask: "A",
  body: "B",
  evidenceIds,
  commitments: [],
  selfAssessment: {},
});

describe("Fall, Year 2", () => {
  it("brings both scenarios, and only the accreditation ask is urgent", () => {
    const early = next(startSession(MIDLAND_STATE, only, STANDARD_ARC));
    expect(early.inbox).toEqual([]);
    const s = fallY2();
    expect(s.inbox).toEqual(["accreditation-ask", "dual-enrollment"]);
    expect(blockingScenarios(s, only).map((x) => x.id)).toEqual(["accreditation-ask"]);
  });
});

describe("The Dual-Enrollment Drop", () => {
  it("cuts 14 fall sections, turns fall into a surplus, and barely moves spring", () => {
    const s = fallY2();
    expect(analyzeTerm(s.program, "fall", A).totalSections).toBe(46);
    expect(balance(s, "fall")).toBe(41800);
    expect(balance(s, "spring")).toBe(2200);
    expect(fillTemplate(dual.documents[0]!.body, s)).toContain("running a $41,800 surplus");
  });

  it("accepting the cut sized to fall puts spring into deficit", () => {
    const s = resolveScenario(fallY2(), dual, "accept-cut", null, CAST).session;
    expect(balance(s, "spring")).toBe(-17800);
    expect(trust(s, "dean")).toBe(61);
  });

  it("a spring staffing plan persuades the dean to a $5,000 cut", () => {
    let s = fallY2();
    const spring = analyzeTerm(s.program, "spring", A);
    s = addEvidence(s, staffingPlanEvidence(s.program, [], spring, spring));
    const r = resolveScenario(s, dual, "show-spring", memo("dean", [s.evidence[0]!.id]), CAST);
    expect(r.outcome.persuaded).toBe(true);
    expect(balance(r.session, "spring")).toBe(-2800);
  });

  it("without the spring numbers, the full cut goes ahead", () => {
    const r = resolveScenario(fallY2(), dual, "show-spring", memo("dean"), CAST);
    expect(r.outcome.persuaded).toBe(false);
    expect(balance(r.session, "spring")).toBe(-17800);
  });

  it("a cap analysis can keep the line and lower ENGL 101 caps to 20", () => {
    let s = fallY2();
    const fall = analyzeTerm(s.program, "fall", A);
    const caps = { ...s.program.policies.caps, ENGL101: 20 };
    const proposed = analyzeTerm({ ...s.program, policies: { ...s.program.policies, caps } }, "fall", A);
    s = addEvidence(s, capAnalysisEvidence(s.program, caps, fall, proposed));
    const r = resolveScenario(s, dual, "lower-caps", memo("dean", [s.evidence[0]!.id]), CAST);
    expect(r.outcome.persuaded).toBe(true);
    expect(analyzeTerm(r.session.program, "fall", A).totalSections).toBe(53);
    expect(balance(r.session, "spring")).toBe(-5000);
  });

  it("funding assessment needs the dean's trust", () => {
    const s = fallY2();
    const fund = dual.options.find((o) => o.id === "fund-assessment")!;
    expect(unavailableReason(s, fund)).toBeNull();
    const cooler = { ...s, program: { ...s.program, stakeholders: s.program.stakeholders.map((x) => (x.id === "dean" ? { ...x, trust: 50 } : x)) } };
    expect(unavailableReason(cooler, fund)).toMatch(/Needs trust of 55/);
    const r = resolveScenario(s, dual, "fund-assessment", null, CAST).session;
    expect(balance(r, "spring")).toBe(-7800);
    expect(trust(r, "accreditor")).toBe(52);
  });
});

describe("The Accreditation Ask", () => {
  const decide = (id: string) => resolveScenario(fallY2(), accreditation, id, null, CAST).session;

  it("paid readers: real assessment, a one-term cost, and a commendation", () => {
    let s = decide("paid-readers");
    expect(s.program.policies.portfolioAssessment).toBe(true);
    expect(trust(s, "accreditor")).toBe(58);
    expect(s.program.budgetPerTerm).toBe(MIDLAND_STATE.budgetPerTerm - 1200);
    expect(s.adminHoursRemaining).toBe(48);
    s = next(s);
    expect(s.program.budgetPerTerm).toBe(MIDLAND_STATE.budgetPerTerm);
    s = next(s);
    expect(trust(s, "accreditor")).toBe(61);
  });

  it("volunteer readers: the same evidence, paid for by adjunct trust", () => {
    const s = decide("volunteer-readers");
    expect(s.program.policies.portfolioAssessment).toBe(true);
    expect(trust(s, "adjunct_faculty")).toBe(35);
  });

  it("grades aren't direct evidence, and the accreditor asks for a monitoring report", () => {
    let s = decide("grades-report");
    expect(s.program.policies.portfolioAssessment).toBe(false);
    expect(trust(s, "accreditor")).toBe(45);
    s = next(next(s));
    expect(trust(s, "accreditor")).toBe(42);
    expect(s.program.politicalCapital).toBe(17);
  });

  it("a standardized exam is a lasting cost", () => {
    const s = next(next(decide("standardized-test")));
    expect(s.program.budgetPerTerm).toBe(MIDLAND_STATE.budgetPerTerm - 3000);
    expect(trust(s, "fyw_director")).toBe(56);
  });
});
