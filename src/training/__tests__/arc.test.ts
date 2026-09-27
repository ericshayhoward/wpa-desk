import { describe, expect, it } from "vitest";
import { MIDLAND_STATE, applyChanges } from "../../model";
import { ARCS, SCENARIOS, STANDARD_ARC, scenarioById } from "../../content";
import {
  SAVE_VERSION,
  advanceTerm,
  createSave,
  parseArc,
  parseSave,
  parseScenario,
  resolveScenario,
  startSession,
  validateScenarioLinks,
  type Scenario,
  type TrainingSession,
} from "../index";
import { submitDueReport } from "../../test-fixtures/reports";

const capMemo = scenarioById("cap-memo")!;

/** A minimal valid scenario, with overrides. */
function scenario(id: string, extra: Record<string, unknown> = {}): Scenario {
  return parseScenario({
    id,
    title: id,
    stages: ["assistant_director", "wpa"],
    documents: [{ from: "chair", genre: "email", subject: "S", body: "B" }],
    options: [
      { id: "a", label: "A", description: "A", consequence: { narrative: "A" } },
      { id: "b", label: "B", description: "B", consequence: { narrative: "B" } },
    ],
    debrief: { weighs: ["W"] },
    ...extra,
  });
}

/**
 * Resolve The Cap Memo, then advance n terms in the standard arc. Only The
 * Cap Memo is in play, so no urgent scenario interrupts the calendar.
 */
function standardAfter(terms: number): { session: TrainingSession; milestones: string[] } {
  let s = startSession(MIDLAND_STATE, [capMemo], STANDARD_ARC);
  s = resolveScenario(s, capMemo, "accept", null).session;
  let milestones: string[] = [];
  for (let i = 0; i < terms; i++) {
    s = submitDueReport(s);
    const r = advanceTerm(s, [capMemo], STANDARD_ARC);
    s = r.session;
    milestones = r.milestones;
  }
  return { session: s, milestones };
}

describe("the standard arc", () => {
  it("loads: 3 years, starting as assistant director", () => {
    expect(ARCS.map((a) => a.id)).toContain("standard");
    expect(STANDARD_ARC.terms).toBe(6);
    const s = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
    expect(s.arcId).toBe("standard");
    expect(s.stage).toBe("assistant_director");
    expect(s.inbox).toEqual(["cap-memo", "syllabus-holdout"]);
  });

  it("makes the player interim director in Fall, Year 3, with a note", () => {
    expect(standardAfter(3).session.stage).toBe("assistant_director");
    const y3 = standardAfter(4);
    expect(y3.session.termIndex).toBe(5);
    expect(y3.session.stage).toBe("wpa");
    expect(y3.milestones[0]).toMatch(/Dr. Cherry begins her sabbatical/);
  });

  it("ends at Spring, Year 3", () => {
    const { session } = standardAfter(5);
    expect(session.termIndex).toBe(6);
    expect(() => advanceTerm(session, SCENARIOS, STANDARD_ARC)).toThrow(/final term of The Standard Arc/);
  });

  it("must be played with the arc it started with", () => {
    const s = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
    expect(() => advanceTerm(s, SCENARIOS)).toThrow(/belongs to the "standard" arc/);
    expect(() => advanceTerm(startSession(MIDLAND_STATE, SCENARIOS), SCENARIOS, STANDARD_ARC)).toThrow(/belongs to free play/);
  });
});

describe("arc calendars", () => {
  const extra = scenario("extra");
  const all = [...SCENARIOS, extra];
  const arc = (calendar: unknown[]) =>
    parseArc({ id: "t", title: "T", description: "D", terms: 4, startStage: "wpa", calendar }, all);

  it("keep unscheduled scenarios out, even when their triggers hold", () => {
    expect(startSession(MIDLAND_STATE, all).inbox).toContain("extra"); // free play
    expect(startSession(MIDLAND_STATE, all, arc([{ scenario: "cap-memo", from: 1 }])).inbox).toEqual(["cap-memo"]);
  });

  it("open and close windows", () => {
    const a = arc([{ scenario: "extra", from: 2, until: 3 }]);
    let s = startSession(MIDLAND_STATE, all, a);
    expect(s.inbox).toEqual([]);
    s = advanceTerm(s, all, a).session;
    expect(s.inbox).toEqual(["extra"]);
  });

  it("name the exact problem in a bad arc file", () => {
    expect(() => arc([{ scenario: "the-detector", from: 1 }])).toThrow(/calendar entry 1: no scenario "the-detector"/);
    expect(() => arc([{ scenario: "extra", from: 2, until: 5 }])).toThrow(/runs past the arc's last term \(4\)/);
    expect(() => arc([{ scenario: "extra", from: 3, until: 2 }])).toThrow(/"until" must be a whole number ≥ 3/);
    expect(() =>
      parseArc({ id: "t", title: "T", description: "D", terms: 4, startStage: "dean", calendar: [] }, all),
    ).toThrow(/startStage: "dean" is not one of assistant_director, wpa/);
  });
});

describe("follow-up triggers", () => {
  const followUp = scenario("follow-up", {
    trigger: { after: { scenario: "cap-memo", options: ["counter-with-data"], persuaded: true, inTerms: 2 } },
  });
  const all = [capMemo, followUp]; // no Late Hire, which would block spring
  const memo = { audience: "dean" as const, subject: "S", ask: "A", body: "B", evidenceIds: [], commitments: [], selfAssessment: {} };

  it("arrive only after the named choice and outcome, and only once enough terms pass", () => {
    // Countered without evidence: the dean isn't persuaded, so no follow-up.
    let s = resolveScenario(startSession(MIDLAND_STATE, all), capMemo, "counter-with-data", memo).session;
    s = advanceTerm(advanceTerm(s, all).session, all).session;
    expect(s.inbox).not.toContain("follow-up");

    // Trust high enough to persuade without evidence: arrives two terms later.
    const trusting = applyChanges(MIDLAND_STATE, [{ kind: "adjustTrust", stakeholder: "dean", delta: 40 }]);
    s = resolveScenario(startSession(trusting, all), capMemo, "counter-with-data", memo).session;
    s = advanceTerm(s, all).session;
    expect(s.inbox).not.toContain("follow-up");
    s = advanceTerm(s, all).session;
    expect(s.inbox).toContain("follow-up");
  });

  it("must point at real scenarios and options", () => {
    const bad = scenario("bad", { trigger: { after: { scenario: "cap-memo", options: ["refuse"] } } });
    expect(() => validateScenarioLinks([...SCENARIOS, bad])).toThrow(/"cap-memo" has no option "refuse"/);
    const missing = scenario("bad", { trigger: { after: { scenario: "nope" } } });
    expect(() => validateScenarioLinks([...SCENARIOS, missing])).toThrow(/no scenario "nope"/);
  });
});

describe("threshold triggers", () => {
  const when = (conditions: unknown[]) => scenario("when", { trigger: { conditions } });
  const arrives = (s: Scenario, program = MIDLAND_STATE) => startSession(program, [s]).inbox.includes("when");

  it("read trust, morale, capital, budget, and D/F/W", () => {
    expect(arrives(when([{ measure: "trust", stakeholder: "adjunct_faculty", below: 45 }]))).toBe(true); // starts at 40
    expect(arrives(when([{ measure: "trust", stakeholder: "adjunct_faculty", atLeast: 45 }]))).toBe(false);
    expect(arrives(when([{ measure: "politicalCapital", atLeast: 20 }]))).toBe(true);
    expect(arrives(when([{ measure: "budgetBalance", below: 0 }]))).toBe(true); // $8,600 deficit
    expect(arrives(when([{ measure: "dfw", courseId: "ENGL101", atLeast: 0.99 }]))).toBe(false);
    const lowMorale = applyChanges(MIDLAND_STATE, [{ kind: "adjustMorale", rank: "adjunct", delta: -100 }]);
    expect(arrives(when([{ measure: "morale", rank: "adjunct", below: 10 }]), lowMorale)).toBe(true);
    expect(arrives(when([{ measure: "morale", rank: "adjunct", below: 10 }]))).toBe(false);
  });

  it("need every condition to hold", () => {
    expect(
      arrives(when([{ measure: "politicalCapital", atLeast: 20 }, { measure: "budgetBalance", atLeast: 0 }])),
    ).toBe(false);
  });

  it("reject authoring mistakes", () => {
    expect(() => when([{ measure: "trust", below: 40 }])).toThrow(/condition 1 stakeholder: "undefined"/);
    expect(() => when([{ measure: "dfw", atLeast: 22 }])).toThrow(/fractions \(0.22 means 22%\)/);
    expect(() => when([{ measure: "morale", rank: "adjunct" }])).toThrow(/needs "below", "atLeast", or both/);
  });
});

describe("version 2 saves", () => {
  it("open as standard-arc sessions with Dr. Cherry added", () => {
    const s = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
    const v2 = JSON.parse(JSON.stringify(createSave(s, "old", new Date())));
    v2.version = 2;
    delete v2.session.arcId;
    v2.session.stage = "wpa";
    v2.session.program.stakeholders = v2.session.program.stakeholders.filter((x: { id: string }) => x.id !== "fyw_director");

    const loaded = parseSave(v2, SCENARIOS, ARCS);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.session.arcId).toBe("standard");
    expect(loaded.session.stage).toBe("assistant_director");
    expect(loaded.session.program.stakeholders.find((x) => x.id === "fyw_director")?.trust).toBe(60);
  });

  it("reject an arc this version doesn't have", () => {
    const f = JSON.parse(JSON.stringify(createSave(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "x", new Date())));
    f.session.arcId = "sandbox";
    expect(() => parseSave(f, SCENARIOS, ARCS)).toThrow(/storyline this version doesn't have \(sandbox\)/);
  });
});
