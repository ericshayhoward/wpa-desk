import { describe, expect, it } from "vitest";
import { MIDLAND_STATE, describeChange, parseChange } from "../../model";
import { CAST, STANDARD_ARC, scenarioById } from "../../content";
import { advanceTerm, resolveScenario, startSession, unavailableReason, type MemoDraft, type TrainingSession } from "../index";
import { closeOutTerm } from "../../test-fixtures/reports";

const holdout = scenarioById("syllabus-holdout")!;
const capMemo = scenarioById("cap-memo")!;
const only = [capMemo, holdout];

const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;
const option = (id: string) => holdout.options.find((o) => o.id === id)!;
const start = () => startSession(MIDLAND_STATE, only, STANDARD_ARC);
const next = (s: TrainingSession) => advanceTerm(closeOutTerm(s), only, STANDARD_ARC).session;
const decide = (s: TrainingSession, id: string, memo: MemoDraft | null = null) =>
  resolveScenario(s, holdout, id, memo, CAST).session;

const proposal: MemoDraft = {
  audience: "fyw_director",
  subject: "Common outcomes",
  ask: "Replace the common syllabus with shared outcomes.",
  body: "Keep the portfolio common; give instructors their own readings.",
  evidenceIds: [],
  commitments: [],
  selfAssessment: {},
};

describe("The Syllabus Holdout", () => {
  it("arrives in Fall, Year 1 as Dr. Cherry's request, and can wait", () => {
    const s = start();
    expect(s.inbox).toContain("syllabus-holdout");
    expect(holdout.urgent).toBe(false);
    expect(holdout.documents[0]!.from).toBe("fyw_director");
    expect(next(resolveScenario(s, capMemo, "accept", null).session).inbox).toContain("syllabus-holdout");
  });

  it("outcomes conversation: Dr. Cherry is pleased, and the portfolio shows up for the accreditor in Year 2", () => {
    let s = decide(start(), "outcomes-conversation");
    expect(trust(s, "fyw_director")).toBe(64);
    expect(trust(s, "adjunct_faculty")).toBe(38);
    s = next(next(s));
    expect(s.termIndex).toBe(3);
    expect(trust(s, "accreditor")).toBe(53);
  });

  it("letting it go costs adjuncts now and the accreditor and Dr. Cherry later", () => {
    let s = decide(start(), "let-it-go");
    expect(trust(s, "adjunct_faculty")).toBe(35);
    expect(s.program.instructors.find((p) => p.rank === "adjunct")!.morale).toBeLessThan(
      MIDLAND_STATE.instructors.find((p) => p.rank === "adjunct")!.morale,
    );
    s = next(next(s));
    expect(trust(s, "accreditor")).toBe(44);
    expect(trust(s, "fyw_director")).toBe(57);
  });

  it("escalating to the chair backfires with the chair, Dr. Cherry, and tenure-line faculty", () => {
    const s = decide(start(), "escalate-chair");
    expect(trust(s, "chair")).toBe(57);
    expect(trust(s, "fyw_director")).toBe(56);
    expect(s.program.instructors.find((p) => p.rank === "tt")!.morale).toBe(59);
    expect(s.program.politicalCapital).toBe(17);
  });

  it("handing it back is cheap, and the reply depends on the relationship", () => {
    const r = resolveScenario(start(), holdout, "hand-back", null, CAST);
    expect(r.session.adminHoursRemaining).toBe(59);
    expect(r.outcome.reply!.body).toMatch(/Next time, I'd like to see you try/);
  });

  it("common outcomes needs Dr. Cherry's trust, a memo, and changes the program's policy", () => {
    const s = start();
    expect(unavailableReason(s, option("common-outcomes"))).toBeNull();
    // Accepting the cap increase costs 2 trust with her, which closes this door.
    const afterAccept = resolveScenario(s, capMemo, "accept", null).session;
    expect(unavailableReason(afterAccept, option("common-outcomes"))).toMatch(/Needs trust of 60 with the Director of First-Year Writing \(now 58\)/);

    expect(() => decide(s, "common-outcomes")).toThrow(/requires a memo/);
    const r = resolveScenario(s, holdout, "common-outcomes", proposal, CAST);
    expect(r.session.program.policies.commonSyllabus).toBe(false);
    expect(r.outcome.changeDescriptions).toContain("Common syllabus: yes → no");
    expect(r.session.adminHoursRemaining).toBe(50);
  });
});

describe("setPolicy", () => {
  it("validates content and describes itself", () => {
    expect(parseChange({ kind: "setPolicy", policy: "commonSyllabus", value: false })).toEqual({
      kind: "setPolicy",
      policy: "commonSyllabus",
      value: false,
    });
    expect(() => parseChange({ kind: "setPolicy", policy: "caps", value: true })).toThrow(/"policy" must be one of/);
    expect(() => parseChange({ kind: "setPolicy", policy: "placement", value: true })).toThrow(
      /"value" for placement must be one of test_scores, directed_self_placement, multiple_measures/,
    );
    expect(describeChange(MIDLAND_STATE, { kind: "setPolicy", policy: "aiPolicy", value: "detector" })).toBe(
      "AI policy: each instructor's choice → AI detection software",
    );
    expect(() => parseChange({ kind: "setPolicy", policy: "commonSyllabus", value: "no" })).toThrow(/"value" must be true or false/);
    expect(describeChange(MIDLAND_STATE, { kind: "setPolicy", policy: "portfolioAssessment", value: true })).toBe(
      "Program-wide portfolio assessment: no → yes",
    );
  });
});
