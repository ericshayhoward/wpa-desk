import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { DEFAULT_ASSUMPTIONS, MIDLAND_STATE, analyzeTerm, applyChanges } from "../../model";
import { SCENARIOS as ALL_SCENARIOS, scenarioById } from "../../content";

/** Only the scenarios under test; others (e.g., urgent spring scenarios) would interrupt the calendar. */
const SCENARIOS = ALL_SCENARIOS.filter((s) => ["cap-memo", "late-hire"].includes(s.id));
import {
  addEvidence,
  advanceTerm,
  capAnalysisEvidence,
  caseFilesToMarkdown,
  parseScenario,
  resolveScenario,
  startSession,
  unavailableReason,
  type MemoDraft,
  type TrainingSession,
} from "../index";

const capMemo = scenarioById("cap-memo")!;

function memo(overrides: Partial<MemoDraft> = {}): MemoDraft {
  return {
    audience: "dean",
    subject: "Holding FYC caps at 24",
    ask: "Hold caps at 24 for one year while we find savings elsewhere.",
    body: "Raising caps saves money only by cutting adjunct sections, and it raises D/F/W.",
    evidenceIds: [],
    commitments: [],
    selfAssessment: { ask: true },
    ...overrides,
  };
}

function withCapEvidence(session: TrainingSession): TrainingSession {
  const caps = { ...session.program.policies.caps, ENGL101: 27, ENGL102: 27 };
  const proposed = applyChanges(session.program, [
    { kind: "setCap", courseId: "ENGL101", cap: 27 },
    { kind: "setCap", courseId: "ENGL102", cap: 27 },
  ]);
  const draft = capAnalysisEvidence(
    session.program,
    caps,
    analyzeTerm(session.program, "fall", DEFAULT_ASSUMPTIONS),
    analyzeTerm(proposed, "fall", DEFAULT_ASSUMPTIONS),
  );
  return addEvidence(session, draft);
}

const cap = (s: TrainingSession, id: string) => s.program.policies.caps[id];
const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;

describe("content", () => {
  it("loads and validates every scenario file", () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
    expect(capMemo.options.map((o) => o.id)).toEqual(["accept", "counter-with-data", "compromise-25", "consult-first"]);
  });

  it("puts The Cap Memo in the inbox because Midland runs a deficit", () => {
    expect(startSession(MIDLAND_STATE, SCENARIOS).inbox).toContain("cap-memo");
  });

  it("keeps it out of the inbox when there's no deficit", () => {
    const funded = applyChanges(MIDLAND_STATE, [{ kind: "adjustBudget", delta: 20000 }]);
    expect(startSession(funded, SCENARIOS).inbox).not.toContain("cap-memo");
  });
});

describe("parseScenario errors name the problem", () => {
  const base = () => parse(`
id: t
title: T
stages: [wpa]
documents: [{ from: dean, genre: memo, subject: S, body: B }]
debrief: { weighs: [x] }
options:
  - { id: a, label: A, description: D, consequence: { narrative: N, changes: [] } }
  - { id: b, label: B, description: D, consequence: { narrative: N, changes: [] } }
`);

  it("accepts a minimal scenario", () => {
    expect(parseScenario(base()).options).toHaveLength(2);
  });
  it("rejects an unknown change kind", () => {
    const s = base();
    s.options[0].consequence.changes = [{ kind: "raiseMorale" }];
    expect(() => parseScenario(s)).toThrow(/unknown change kind "raiseMorale"/);
  });
  it("rejects delayed effects at the option level", () => {
    const s = base();
    s.options[0].delayed = [];
    expect(() => parseScenario(s)).toThrow(/inside the consequence/);
  });
  it("rejects an unknown stakeholder", () => {
    const s = base();
    s.documents[0].from = "president";
    expect(() => parseScenario(s)).toThrow(/"president" is not one of/);
  });
});

describe("The Cap Memo", () => {
  it("accept: caps rise, the dean is pleased, adjuncts pay for it later", () => {
    const start = startSession(MIDLAND_STATE, SCENARIOS);
    const { session, outcome } = resolveScenario(start, capMemo, "accept", null);

    expect(cap(session, "ENGL101")).toBe(27);
    expect(trust(session, "dean")).toBe(63);
    expect(trust(session, "adjunct_faculty")).toBe(28);
    expect(session.program.politicalCapital).toBe(24);
    expect(outcome.impact.comparison.sectionsByRank.adjunct).toBe(-5);
    expect(session.inbox).not.toContain("cap-memo");

    // Delayed effect lands two terms later.
    const t2 = advanceTerm(session, SCENARIOS);
    expect(t2.applied).toHaveLength(0);
    const t3 = advanceTerm(t2.session, SCENARIOS);
    expect(t3.applied).toHaveLength(1);
    const adjuncts = t3.session.program.instructors.find((p) => p.rank === "adjunct")!;
    expect(adjuncts.headcount).toBe(12);
    expect(adjuncts.morale).toBe(35);
    expect(t3.session.inbox).not.toContain("cap-memo");

    // Morale below 40 means turnover: one more adjunct leaves after the next term.
    // That erodes the slack that kept The Late Hire away, so it arrives in
    // spring of year 2 and three more adjuncts withdraw (12 → 11 → 8).
    expect(t3.drift).toEqual([]);
    const t4 = advanceTerm(t3.session, SCENARIOS);
    expect(t4.drift[0]).toMatch(/Morale among adjunct faculty is low \(35\)/);
    expect(t4.session.inbox).toContain("late-hire");
    expect(t4.session.program.instructors.find((p) => p.rank === "adjunct")!.headcount).toBe(8);
  });

  it("counter-with-data requires a memo", () => {
    const start = startSession(MIDLAND_STATE, SCENARIOS);
    expect(() => resolveScenario(start, capMemo, "counter-with-data", null)).toThrow(/requires a memo/);
  });

  it("counter-with-data without evidence: unpersuaded, caps go to 27 anyway", () => {
    const start = startSession(MIDLAND_STATE, SCENARIOS);
    const { session, outcome } = resolveScenario(start, capMemo, "counter-with-data", memo());
    expect(outcome.persuaded).toBe(false);
    expect(outcome.missingEvidence).toEqual(["cap_analysis"]);
    expect(cap(session, "ENGL101")).toBe(27);
    expect(session.program.politicalCapital).toBe(15);
    expect(session.adminHoursRemaining).toBe(54);
    expect(session.pending).toHaveLength(0);
  });

  it("counter-with-data with cap analysis attached: persuaded, one-year reprieve", () => {
    const start = withCapEvidence(startSession(MIDLAND_STATE, SCENARIOS));
    const evidenceId = start.evidence[0]!.id;
    const { session, outcome } = resolveScenario(
      start,
      capMemo,
      "counter-with-data",
      memo({ evidenceIds: [evidenceId], commitments: [{ text: "Share D/F/W data by next fall", dueInTerms: 2, effortHours: 4 }] }),
    );
    expect(outcome.persuaded).toBe(true);
    expect(cap(session, "ENGL101")).toBe(24);
    expect(analyzeTerm(session.program, "fall", DEFAULT_ASSUMPTIONS).budgetBalance).toBe(0);

    // The memo and its commitment are filed.
    expect(session.dossier).toHaveLength(1);
    expect(session.commitments[0]).toMatchObject({ text: "Share D/F/W data by next fall", dueTerm: 3, status: "open" });

    // Holding caps at 24 leaves no slack, so The Late Hire arrives in spring
    // and must be handled before the year ends. Then the reprieve expires.
    const t2 = advanceTerm(session, SCENARIOS).session;
    expect(t2.inbox).toContain("late-hire");
    const handled = resolveScenario(t2, scenarioById("late-hire")!, "add-seats", null).session;
    const t3 = advanceTerm(handled, SCENARIOS).session;
    expect(t3.program.budgetPerTerm).toBe(MIDLAND_STATE.budgetPerTerm);
  });

  it("blocks options the player can't afford", () => {
    const broke = startSession(applyChanges(MIDLAND_STATE, [{ kind: "adjustPoliticalCapital", delta: -18 }]), SCENARIOS);
    const counter = capMemo.options.find((o) => o.id === "counter-with-data")!;
    expect(unavailableReason(broke, counter)).toMatch(/political capital/);
    expect(() => resolveScenario(broke, capMemo, "counter-with-data", memo())).toThrow(/political capital/);
  });
});

describe("case file export", () => {
  it("includes the memo, attached evidence, and commitments", () => {
    const start = withCapEvidence(startSession(MIDLAND_STATE, SCENARIOS));
    const { session } = resolveScenario(
      start,
      capMemo,
      "counter-with-data",
      memo({ evidenceIds: [start.evidence[0]!.id], commitments: [{ text: "Report D/F/W", dueInTerms: 2, effortHours: 4 }] }),
    );
    const names = { short: (id: string) => id, byline: (id: string) => `byline:${id}` };
    const md = caseFilesToMarkdown(session, SCENARIOS, names, new Date("2026-09-27T00:00:00Z"));
    expect(md).toContain("**Subject:** Holding FYC caps at 24");
    expect(md).toContain("**To:** byline:dean");
    expect(md).toContain("  - Adjunct sections: 36 → 31 (−5).");
    expect(md).toContain("- Report D/F/W — open, due Fall, Year 2");
  });
});
