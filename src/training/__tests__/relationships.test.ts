import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges, type ProgramChange } from "../../model";
import { CAST, SCENARIOS as ALL_SCENARIOS, scenarioById } from "../../content";

/** Only the scenarios under test; others (e.g., urgent spring scenarios) would interrupt the calendar. */
const SCENARIOS = ALL_SCENARIOS.filter((s) => ["cap-memo", "late-hire"].includes(s.id));
import {
  addEvidence,
  advanceTerm,
  applyMoraleAttrition,
  capAnalysisEvidence,
  parseCast,
  resolveScenario,
  startSession,
  unavailableReason,
  type MemoDraft,
  type TrainingSession,
} from "../index";

const capMemo = scenarioById("cap-memo")!;
const lateHire = scenarioById("late-hire")!;
const trustChange = (stakeholder: "dean" | "chair", delta: number): ProgramChange => ({ kind: "adjustTrust", stakeholder, delta });

function start(changes: ProgramChange[] = []): TrainingSession {
  return startSession(applyChanges(MIDLAND_STATE, changes), SCENARIOS);
}

function withEvidence(s: TrainingSession): TrainingSession {
  const proposed = applyChanges(s.program, [{ kind: "setCap", courseId: "ENGL101", cap: 27 }]);
  return addEvidence(
    s,
    capAnalysisEvidence(s.program, { ...s.program.policies.caps, ENGL101: 27 }, analyzeTerm(s.program, "fall", A), analyzeTerm(proposed, "fall", A)),
  );
}

const memo = (evidenceIds: string[] = []): MemoDraft => ({
  audience: "dean", subject: "S", ask: "A", body: "B", evidenceIds, commitments: [], selfAssessment: {},
});

describe("persuasion depends on the relationship", () => {
  it("the right evidence isn't enough if the dean doesn't trust you (Alvarez needs 30)", () => {
    const s = withEvidence(start([trustChange("dean", -30)])); // trust 25
    const { outcome } = resolveScenario(s, capMemo, "counter-with-data", memo([s.evidence[0]!.id]), CAST);
    expect(outcome.persuaded).toBe(false);
    expect(outcome.persuasion).toEqual({ reader: "dean", trust: 25, needed: 30, hadEvidence: true });
  });

  it("a dean who trusts you deeply takes your word without numbers (Alvarez needs 90)", () => {
    const s = start([trustChange("dean", 40)]); // trust 95
    const { outcome } = resolveScenario(s, capMemo, "counter-with-data", memo(), CAST);
    expect(outcome.persuaded).toBe(true);
    expect(outcome.persuasion).toMatchObject({ trust: 95, needed: 90, hadEvidence: false });
  });

  it("without a cast, the default profile applies (25 with evidence / 80 without)", () => {
    const { outcome } = resolveScenario(start([trustChange("dean", 30)]), capMemo, "counter-with-data", memo());
    expect(outcome.persuasion).toMatchObject({ trust: 85, needed: 80 });
    expect(outcome.persuaded).toBe(true);
  });
});

describe("replies reflect the relationship", () => {
  it("warm at high trust, default in the middle, cool at low trust", () => {
    const reply = (delta: number, option: string, draft: MemoDraft | null = null) =>
      resolveScenario(start([trustChange("dean", delta)]), capMemo, option, draft, CAST).outcome.reply!.body;
    expect(reply(20, "accept")).toMatch(/^Thank you\. I knew I could count on you/);
    expect(reply(0, "accept")).toMatch(/^Thank you for being a team player/);
    expect(reply(-20, "counter-with-data", memo())).toMatch(/^I've asked before for data rather than arguments/);
  });
});

describe("options that depend on a relationship", () => {
  const borrow = lateHire.options.find((o) => o.id === "borrow-colleagues")!;
  const springAfter = (capChoice: string) =>
    advanceTerm(resolveScenario(start(), capMemo, capChoice, null, CAST).session, SCENARIOS).session;

  it("the chair won't lend colleagues at default trust", () => {
    const s = springAfter("compromise-25"); // chair still 60
    expect(unavailableReason(s, borrow)).toBe("Needs trust of 62 with the English Department Chair (now 60).");
  });

  it("consulting first in The Cap Memo earns the chair's help later", () => {
    // consult-first raises caps to 27, which leaves enough slack that the Late Hire
    // doesn't come in year 1; force the gap to test the option directly.
    let s = resolveScenario(start(), capMemo, "consult-first", null, CAST).session;
    expect(s.program.stakeholders.find((x) => x.id === "chair")!.trust).toBe(64);
    // At caps of 27, spring needs 30 adjunct sections; 12 adjuncts minus the 3
    // who withdraw leaves 27, a gap of exactly 3.
    s = { ...s, program: applyChanges(s.program, [{ kind: "adjustHeadcount", rank: "adjunct", delta: -2 }]) };
    s = advanceTerm(s, SCENARIOS).session;
    expect(s.inbox).toContain("late-hire");
    expect(analyzeTerm(s.program, "spring", A).unstaffedSections).toBe(3);
    expect(unavailableReason(s, borrow)).toBeNull();

    const { session } = resolveScenario(s, lateHire, "borrow-colleagues", null, CAST);
    expect(analyzeTerm(session.program, "spring", A).unstaffedSections).toBe(0);
    expect(session.program.instructors.find((p) => p.rank === "tt")!.sectionsPerTerm).toBe(2);
    expect(advanceTerm(session, SCENARIOS).session.program.instructors.find((p) => p.rank === "tt")!.sectionsPerTerm).toBe(1);
  });
});

describe("morale turnover", () => {
  it("one person leaves per term while a pool is below 40", () => {
    const low = applyChanges(MIDLAND_STATE, [{ kind: "adjustMorale", rank: "adjunct", delta: -10 }]); // 35
    const r = applyMoraleAttrition(low);
    expect(r.program.instructors.find((p) => p.rank === "adjunct")!.headcount).toBe(13);
    expect(r.notes).toHaveLength(1);
    expect(applyMoraleAttrition(MIDLAND_STATE).notes).toEqual([]);
  });

  it("GTAs don't quit mid-degree", () => {
    const low = applyChanges(MIDLAND_STATE, [{ kind: "adjustMorale", rank: "gta", delta: -50 }]);
    expect(applyMoraleAttrition(low).notes).toEqual([]);
  });
});

describe("cast content", () => {
  it("loads Midland's five named people", () => {
    expect(CAST.map((c) => c.shortName)).toEqual(["Dean Alvarez", "Dr. Hale", "Dr. Cherry", "Associate Provost Okafor", "Dr. Raman"]);
  });

  it("rejects bad profiles with readable errors", () => {
    const base = { stakeholder: "dean", name: "N", shortName: "S", title: "T", bio: "B", responds: "R" };
    expect(() => parseCast([{ ...base, stakeholder: "president" }])).toThrow(/"president" is not a stakeholder/);
    expect(() => parseCast([{ ...base, persuasion: { withEvidence: 50, withoutEvidence: 40 } }])).toThrow(/can't be lower/);
    expect(() => parseCast([base, base])).toThrow(/only one character/);
    expect(() => parseCast([{ ...base, portrait: "" }])).toThrow(/"portrait" must be non-empty/);
  });

  it("each named person has a portrait; one without falls back to initials", () => {
    expect(CAST.map((c) => c.portrait)).toEqual(["alvarez", "hale", "cherry", "okafor", "raman"]);
    const base = { stakeholder: "dean", name: "N", shortName: "S", title: "T", bio: "B", responds: "R" };
    expect(parseCast([base])[0]).not.toHaveProperty("portrait");
  });
});
