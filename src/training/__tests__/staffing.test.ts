import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges } from "../../model";
import { ARCS, CAST, SCENARIOS, STANDARD_ARC, scenarioById } from "../../content";
import {
  COMMITMENT_EFFECTS,
  PERSUASION_CAPITAL,
  STAFFING_EFFECTS,
  addEvidence,
  advanceTerm,
  caseFilesToMarkdown,
  capAnalysisEvidence,
  createSave,
  deliverCommitment,
  parseSave,
  resolveScenario,
  resolveStaffing,
  staffingDue,
  startSession,
  submitReport,
  type TrainingSession,
} from "../index";
import { closeOutTerm } from "../../test-fixtures/reports";
import type { ProgramChange } from "../../model";

const applyChangesTo = (s: TrainingSession, c: ProgramChange[]) => ({ ...s, program: applyChanges(s.program, c) });

const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;
const unstaffed = (s: TrainingSession) => analyzeTerm(s.program, s.termIndex % 2 ? "fall" : "spring", A).unstaffedSections;
/** Fall Y1 in the standard arc with four adjuncts gone: 6 sections uncovered. No scenarios, so nothing else intervenes. */
const short = () => startSession(applyChanges(MIDLAND_STATE, [{ kind: "adjustHeadcount", rank: "adjunct", delta: -4 }]), [], STANDARD_ARC);

describe("routine staffing", () => {
  it("blocks the term while sections have no instructor, in arcs that use it", () => {
    const s = short();
    expect(unstaffed(s)).toBe(6);
    expect(staffingDue(s, STANDARD_ARC, [])).toEqual({ unstaffed: 6 });
    expect(() => advanceTerm(s, [], STANDARD_ARC)).toThrow("Some Fall, Year 1 sections still have no instructor.");
    // Free play has no routine staffing.
    const free = startSession(applyChanges(MIDLAND_STATE, [{ kind: "adjustHeadcount", rank: "adjunct", delta: -4 }]), []);
    expect(staffingDue(free, undefined, [])).toBeNull();
  });

  it("leaves the gap to The Late Hire when it's in the inbox", () => {
    const lateHire = scenarioById("late-hire")!;
    const s = { ...short(), inbox: ["late-hire"] };
    expect(staffingDue(s, STANDARD_ARC, [lateHire])).toBeNull();
  });

  it("hiring covers the gap for a couple of hours", () => {
    const r = resolveStaffing(short(), STANDARD_ARC, [], "hire");
    expect(unstaffed(r.session)).toBe(0);
    expect(r.session.adminHoursRemaining).toBe(60 - STAFFING_EFFECTS.hireHours);
    expect(r.note).toBe("You hired 2 adjuncts to cover 6 sections.");
    expect(r.session.staffingLog).toEqual([{ termIndex: 1, choice: "hire", sections: 6 }]);
  });

  it("teaching a section yourself costs 20 hours, earns trust, and ends with the term", () => {
    let s = resolveStaffing(short(), STANDARD_ARC, [], "teach").session;
    expect(unstaffed(s)).toBe(0);
    expect(s.adminHoursRemaining).toBe(40);
    expect([trust(s, "adjunct_faculty"), trust(s, "gta_cohort"), trust(s, "fyw_director")]).toEqual([42, 53, 61]);
    const gtas = s.program.instructors.find((p) => p.rank === "gta")!.headcount;
    s = advanceTerm(s, [], STANDARD_ARC).session;
    expect(s.program.instructors.find((p) => p.rank === "gta")!.headcount).toBe(gtas - 1);
  });

  it("teaching without the hours comes out of the dissertation", () => {
    const s = resolveStaffing({ ...short(), adminHoursRemaining: 5 }, STANDARD_ARC, [], "teach").session;
    expect(s.adminHoursRemaining).toBe(0);
    expect(s.overtimeHours).toBe(15);
  });

  it("cancelling costs students their seats this term, and the sections come back", () => {
    let s = resolveStaffing(short(), STANDARD_ARC, [], "cancel").session;
    expect(unstaffed(s)).toBe(0);
    expect(analyzeTerm(s.program, "fall", A).totalSeatsUnserved).toBeGreaterThan(0);
    expect(trust(s, "students")).toBe(51);
    s = advanceTerm(s, [], STANDARD_ARC).session;
    expect(s.program.cancellations).toEqual([]);
  });

  it("must be settled before the capstone report can be submitted, and appears in the case files", () => {
    let s = startSession(MIDLAND_STATE, [], STANDARD_ARC);
    while (s.termIndex < 6) s = advanceTerm(closeOutTerm(s), [], STANDARD_ARC).session;
    s = applyChangesTo(s, [{ kind: "adjustHeadcount", rank: "adjunct", delta: -4 }]);
    const sections = { program_data: { body: "x", history: [] }, assessment: { body: "x", history: [] }, initiatives: { body: "x", history: [] }, requests: { body: "x", history: [] }, looking_back: { body: "x", history: [] } };
    const drafted = { ...s, reportDraft: { termIndex: 6, startedAt: new Date().toISOString(), sections } };
    expect(() => submitReport(drafted, STANDARD_ARC, [], new Date())).toThrow("Cover this term's sections before submitting the report.");
    const covered = resolveStaffing(drafted, STANDARD_ARC, [], "hire").session;
    expect(submitReport(covered, STANDARD_ARC, [], new Date()).session.ending).toBeDefined();
    const md = caseFilesToMarkdown(covered, [], { short: (x) => x, byline: (x) => x }, new Date());
    expect(md).toContain("## Staffing decisions");
    expect(md).toMatch(/Spring, Year 3: \d+ sections without an instructor; hired adjuncts\./);
  });

  it("is kept in saves, and older saves start with no decisions", () => {
    const s = resolveStaffing(short(), STANDARD_ARC, [], "hire").session;
    const loaded = parseSave(JSON.parse(JSON.stringify(createSave(s, "x", new Date()))), SCENARIOS, ARCS).session;
    expect(loaded.staffingLog).toEqual(s.staffingLog);
    const v5 = JSON.parse(JSON.stringify(createSave(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "x", new Date())));
    v5.version = 5;
    delete v5.session.staffingLog;
    expect(parseSave(v5, SCENARIOS, ARCS).session.staffingLog).toEqual([]);
  });
});

describe("political capital earned by delivering", () => {
  const capMemo = scenarioById("cap-memo")!;

  it("a memo that persuades earns capital back", () => {
    let s = startSession(MIDLAND_STATE, [capMemo]);
    const caps = { ...s.program.policies.caps, ENGL101: 27, ENGL102: 27 };
    const fall = analyzeTerm(s.program, "fall", A);
    s = addEvidence(s, capAnalysisEvidence(s.program, caps, fall, analyzeTerm({ ...s.program, policies: { ...s.program.policies, caps } }, "fall", A)));
    const memo = { audience: "dean" as const, subject: "S", ask: "A", body: "B", commitments: [], selfAssessment: {} };
    const won = resolveScenario(s, capMemo, "counter-with-data", { ...memo, evidenceIds: [s.evidence[0]!.id] }, CAST);
    expect(won.outcome.politicalCapital).toEqual({ before: 20, after: 20 - 5 + PERSUASION_CAPITAL });
    const lost = resolveScenario(s, capMemo, "counter-with-data", { ...memo, evidenceIds: [] }, CAST);
    expect(lost.outcome.politicalCapital).toEqual({ before: 20, after: 15 });
  });

  it("each kept commitment earns capital", () => {
    const memo = {
      audience: "dean" as const, subject: "S", ask: "A", body: "B", evidenceIds: [], selfAssessment: {},
      commitments: [{ text: "Share D/F/W data", dueInTerms: 1, effortHours: 4 }],
    };
    let s = resolveScenario(startSession(MIDLAND_STATE, [capMemo]), capMemo, "compromise-25", memo, CAST).session;
    const before = s.program.politicalCapital;
    s = deliverCommitment(s, s.commitments[0]!.id);
    expect(s.program.politicalCapital).toBe(before + COMMITMENT_EFFECTS.keptCapital);
  });
});
