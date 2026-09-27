import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges } from "../../model";
import { CAST, STANDARD_ARC, scenarioById } from "../../content";
import {
  addEvidence,
  advanceTerm,
  capAnalysisEvidence,
  resolveScenario,
  startSession,
  unavailableReason,
  type MemoDraft,
  type Scenario,
  type TrainingSession,
} from "../index";
import { closeOutTerm } from "../../test-fixtures/reports";

const capMemo = scenarioById("cap-memo")!;
const review = scenarioById("cap-review")!;
const dsp = scenarioById("dsp-pilot")!;
const detector = scenarioById("detector")!;

const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;
const memo = (audience: MemoDraft["audience"], evidenceIds: string[] = []): MemoDraft => ({
  audience, subject: "S", ask: "A", body: "B", evidenceIds, commitments: [], selfAssessment: {},
});
/** Evidence for raising both caps to 27 in the current term. */
function withCapEvidence(s: TrainingSession): TrainingSession {
  const caps = { ...s.program.policies.caps, ENGL101: 27, ENGL102: 27 };
  const before = analyzeTerm(s.program, "fall", A);
  const after = analyzeTerm({ ...s.program, policies: { ...s.program.policies, caps } }, "fall", A);
  return addEvidence(s, capAnalysisEvidence(s.program, caps, before, after));
}
function advance(s: TrainingSession, scenarios: Scenario[], to: number): TrainingSession {
  while (s.termIndex < to) s = advanceTerm(closeOutTerm(s), scenarios, STANDARD_ARC).session;
  return s;
}

describe("The Cap Review", () => {
  const list = [capMemo, review];
  const after = (choice: string, evidence = false, termOfChoice = 1) => {
    let s = startSession(MIDLAND_STATE, list, STANDARD_ARC);
    s = advance(s, list, termOfChoice);
    if (evidence) s = withCapEvidence(s);
    const m = capMemo.options.find((o) => o.id === choice)!.memo?.required ? memo("dean", s.evidence.map((e) => e.id)) : null;
    s = resolveScenario(s, capMemo, choice, m, CAST).session;
    return s;
  };

  it("arrives in Spring, Year 2 for players who held caps below 27, and only for them", () => {
    expect(advance(after("compromise-25"), list, 4).inbox).toContain("cap-review");
    const reprieve = after("counter-with-data", true);
    expect(reprieve.decisions[0]!.persuaded).toBe(true);
    expect(advance(reprieve, list, 4).inbox).toContain("cap-review");
    expect(advance(after("accept"), list, 4).inbox).not.toContain("cap-review");
    // Countered without numbers: caps went to 27, so there's nothing to review.
    expect(advance(after("counter-with-data"), list, 4).inbox).not.toContain("cap-review");
  });

  it("comes a term later if The Cap Memo was decided late", () => {
    const late = after("compromise-25", false, 2);
    expect(advance(late, list, 4).inbox).not.toContain("cap-review");
    expect(advance(late, list, 5).inbox).toContain("cap-review");
  });

  it("with numbers, the current caps become the standard; without, they go to 27", () => {
    let s = advance(after("compromise-25"), list, 4);
    const without = resolveScenario(s, review, "make-the-case", memo("dean"), CAST);
    expect(without.outcome.persuaded).toBe(false);
    expect(without.session.program.policies.caps.ENGL101).toBe(27);

    s = withCapEvidence(s);
    const withNumbers = resolveScenario(s, review, "make-the-case", memo("dean", [s.evidence.at(-1)!.id]), CAST);
    expect(withNumbers.outcome.persuaded).toBe(true);
    expect(withNumbers.session.program.policies.caps.ENGL101).toBe(25);
    expect(withNumbers.outcome.reply!.body).toMatch(/standard now, not an exception/);
  });
});

describe("The DSP Pilot", () => {
  const list = [dsp];
  const springY2 = (program = MIDLAND_STATE) => advance(startSession(program, list, STANDARD_ARC), list, 4);

  it("arrives in Spring, Year 2 and can wait", () => {
    expect(advance(startSession(MIDLAND_STATE, list, STANDARD_ARC), list, 3).inbox).toEqual([]);
    expect(springY2().inbox).toEqual(["dsp-pilot"]);
    expect(dsp.urgent).toBe(false);
  });

  it("adopting DSP moves students out of the studio", () => {
    const s = resolveScenario(springY2(), dsp, "adopt-dsp", null, CAST).session;
    expect(s.program.policies.placement).toBe("directed_self_placement");
    expect(s.program.courses.find((c) => c.id === "ENGL101S")!.seatDemand.fall).toBe(144);
    expect(trust(s, "writing_center")).toBe(63);
  });

  it("support needs Dr. Raman's trust and costs $4,000 a term", () => {
    const s = springY2();
    const support = dsp.options.find((o) => o.id === "adopt-with-support")!;
    expect(unavailableReason(s, support)).toBeNull();
    const cool = springY2(applyChanges(MIDLAND_STATE, [{ kind: "adjustTrust", stakeholder: "writing_center", delta: -10 }]));
    expect(unavailableReason(cool, support)).toMatch(/Needs trust of 60/);
    const r = resolveScenario(s, dsp, "adopt-with-support", null, CAST).session;
    expect(r.program.budgetPerTerm).toBe(MIDLAND_STATE.budgetPerTerm - 4000);
    expect(trust(r, "writing_center")).toBe(71);
  });

  it("multiple measures and returning to tests set placement accordingly", () => {
    expect(resolveScenario(springY2(), dsp, "multiple-measures", null, CAST).session.program.policies.placement).toBe(
      "multiple_measures",
    );
    const back = resolveScenario(springY2(), dsp, "return-to-tests", null, CAST).session;
    expect(back.program.policies.placement).toBe("test_scores");
    expect(trust(back, "fyw_director")).toBe(56);
  });
});

describe("The Detector", () => {
  const list = [detector];
  const springY2 = () => advance(startSession(MIDLAND_STATE, list, STANDARD_ARC), list, 4);

  it("piloting the detector pleases the provost's office, then a false accusation lands", () => {
    let s = resolveScenario(springY2(), detector, "pilot-detector", null, CAST).session;
    expect(s.program.policies.aiPolicy).toBe("detector");
    expect(trust(s, "provost_office")).toBe(56);
    s = advance(s, list, 5);
    expect(trust(s, "students")).toBe(46);
    expect(trust(s, "provost_office")).toBe(53);
  });

  it("program guidance needs a memo and helps the GTAs", () => {
    const s = springY2();
    expect(() => resolveScenario(s, detector, "program-guidance", null, CAST)).toThrow(/requires a memo/);
    const r = resolveScenario(s, detector, "program-guidance", memo("provost_office"), CAST).session;
    expect(r.program.policies.aiPolicy).toBe("program_guidance");
    expect(trust(r, "gta_cohort")).toBe(55);
  });

  it("senate review earns the senate's trust and ends the license", () => {
    let s = resolveScenario(springY2(), detector, "senate-review", null, CAST).session;
    expect(trust(s, "faculty_senate")).toBe(55);
    s = advance(s, list, 5);
    expect(trust(s, "faculty_senate")).toBe(57);
    expect(s.program.policies.aiPolicy).toBe("instructor_choice");
  });
});
