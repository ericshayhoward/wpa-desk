import { describe, expect, it } from "vitest";
import { MIDLAND_STATE, applyChanges, type ProgramChange } from "../../model";
import { ARCS, SCENARIOS, STANDARD_ARC, scenarioById } from "../../content";
import {
  SAVE_VERSION,
  advanceTerm,
  caseFilesToMarkdown,
  computeEnding,
  createSave,
  dissertationStatus,
  parseSave,
  recordTerm,
  reportDue,
  resolveScenario,
  startSession,
  submitReport,
  type TrainingSession,
} from "../index";
import { submitDueReport } from "../../test-fixtures/reports";

const capMemo = scenarioById("cap-memo")!;
const only = [capMemo]; // keeps The Late Hire from interrupting the calendar
const names = { short: (id: string) => id, byline: (id: string) => id };

function start(changes: ProgramChange[] = []): TrainingSession {
  const s = startSession(applyChanges(MIDLAND_STATE, changes), only, STANDARD_ARC);
  return resolveScenario(s, capMemo, "compromise-25", null).session;
}

/** Advance to a term, submitting reports along the way. */
function to(s: TrainingSession, termIndex: number): TrainingSession {
  while (s.termIndex < termIndex) s = advanceTerm(submitDueReport(s), only, STANDARD_ARC).session;
  return s;
}

/** Play the whole arc and submit the capstone. */
const finish = (s: TrainingSession) => submitDueReport(to(s, 6));

describe("term history", () => {
  it("records a baseline and one record per completed term", () => {
    const s = start();
    expect(s.baseline.totalSections).toBe(60);
    expect(s.history).toEqual([]);
    const t3 = to(s, 3);
    expect(t3.history.map((r) => r.termIndex)).toEqual([1, 2]);
    expect(t3.history[0]!.adminHoursUnspent).toBe(57); // 60 minus the compromise's 3 hours
  });
});

describe("year-end reports", () => {
  it("are due each spring and block the term until submitted", () => {
    let s = to(start(), 2);
    expect(reportDue(s, STANDARD_ARC)?.playerSections).toEqual(["program_data"]);
    expect(() => advanceTerm(s, only, STANDARD_ARC)).toThrow("Submit the year-end report before Spring, Year 1 ends.");
    expect(() => submitReport(s, STANDARD_ARC, SCENARIOS, new Date())).toThrow("Write your section first: Program data.");

    s = submitDueReport(s, "Sections held steady.");
    expect(reportDue(s, STANDARD_ARC)).toBeNull();
    expect(s.adminHoursRemaining).toBe(54); // 60 − 6
    const r = s.reports[0]!;
    expect(r.year).toBe(1);
    expect(r.sections.map((x) => [x.id, x.author])).toEqual([
      ["program_data", "player"],
      ["assessment", "fyw_director"],
      ["initiatives", "fyw_director"],
      ["requests", "fyw_director"],
    ]);
    expect(r.sections[0]!.body).toBe("Sections held steady.");
    expect(r.sections[0]!.history!.at(-1)!.reason).toBe("sent");
    // The supervisor's sections are written from the player's own data.
    expect(r.sections[2]!.body).toMatch(/the Cap Memo \(propose a compromise at 25\)/);
    expect(r.appendix.some((l) => l.startsWith("Fall, Year 1:"))).toBe(true);
  });

  it("come out of dissertation time when admin hours run out", () => {
    let s = to(start(), 2);
    s = { ...s, adminHoursRemaining: 2 };
    s = submitDueReport(s);
    expect(s.adminHoursRemaining).toBe(0);
    expect(s.overtimeHours).toBe(4);
    expect(recordTerm(s).adminHoursUnspent).toBe(-4);
  });

  it("take job applications out of Fall, Year 3", () => {
    const s = to(start(), 4);
    const r = advanceTerm(submitDueReport(s), only, STANDARD_ARC);
    expect(r.session.adminHoursRemaining).toBe(45);
    expect(r.milestones.join(" ")).toMatch(/Job applications are due this fall/);
  });
});

describe("the dissertation", () => {
  it("fills with unspent admin hours", () => {
    const s = to(start(), 3);
    const d = dissertationStatus(s, STANDARD_ARC)!;
    expect(d.hours).toBe(57 + 54);
    expect(d.progress).toBeCloseTo(111 / 240);
    expect(d.status).toBe("behind");
  });
});

describe("the ending", () => {
  it("arrives with the capstone report and explains itself", () => {
    const s = finish(start());
    expect(s.reports.map((r) => r.year)).toEqual([1, 2, 3]);
    expect(s.reports[2]!.sections.every((x) => x.author === "player")).toBe(true);
    const e = s.ending!;
    expect(e.factors.map((f) => f.id)).toEqual(["program", "recommender", "relationships", "instructors", "commitments", "dissertation"]);
    expect(e.factors.reduce((n, f) => n + f.max, 0)).toBe(100);
    expect(e.score).toBeCloseTo(e.factors.reduce((n, f) => n + f.points, 0), 5);
    expect(["tenure_track", "two_year", "rotated_out"]).toContain(e.id);
    expect(() => advanceTerm(s, only, STANDARD_ARC)).toThrow(/has ended/);
  });

  it("gives the university job to a strong record with the dissertation on track", () => {
    const strong = finish(
      start([
        { kind: "adjustTrust", stakeholder: "fyw_director", delta: 35 },
        { kind: "adjustTrust", stakeholder: "dean", delta: 30 },
        { kind: "adjustTrust", stakeholder: "chair", delta: 25 },
        { kind: "adjustTrust", stakeholder: "provost_office", delta: 30 },
        { kind: "adjustTrust", stakeholder: "writing_center", delta: 20 },
        { kind: "adjustTrust", stakeholder: "adjunct_faculty", delta: 40 },
        { kind: "adjustTrust", stakeholder: "gta_cohort", delta: 30 },
      ]),
    );
    expect(strong.ending!.dissertation.status).not.toBe("behind");
    expect(strong.ending!.id).toBe("tenure_track");
    expect(strong.ending!.title).toBe("Assistant Professor and Director of First-Year Writing");
  });

  it("holds the university job back when the dissertation is behind, and says why", () => {
    const s = finish(
      start([
        { kind: "adjustTrust", stakeholder: "fyw_director", delta: 35 },
        { kind: "adjustTrust", stakeholder: "dean", delta: 30 },
        { kind: "adjustTrust", stakeholder: "chair", delta: 25 },
        { kind: "adjustTrust", stakeholder: "provost_office", delta: 30 },
        { kind: "adjustTrust", stakeholder: "writing_center", delta: 20 },
        { kind: "adjustTrust", stakeholder: "adjunct_faculty", delta: 40 },
        { kind: "adjustTrust", stakeholder: "gta_cohort", delta: 30 },
      ]),
    );
    // Same record, but just short of on track: 29 × 6 = 174 of the 180 hours needed.
    const behind = { ...s, history: s.history.map((r) => ({ ...r, adminHoursUnspent: 29 })) };
    const e = computeEnding(behind, STANDARD_ARC);
    expect(e.dissertation.status).toBe("behind");
    expect(e.score).toBeGreaterThanOrEqual(STANDARD_ARC.endings!.tenureTrackAt);
    expect(e.id).toBe("two_year");
    expect(e.gateNote).toMatch(/dissertation finished or on track/);
  });

  it("rotates out a record with broken relationships", () => {
    const s = finish(
      start([
        { kind: "adjustTrust", stakeholder: "fyw_director", delta: -40 },
        { kind: "adjustTrust", stakeholder: "dean", delta: -40 },
        { kind: "adjustTrust", stakeholder: "chair", delta: -40 },
        { kind: "adjustTrust", stakeholder: "provost_office", delta: -40 },
        { kind: "adjustTrust", stakeholder: "writing_center", delta: -40 },
        { kind: "adjustTrust", stakeholder: "adjunct_faculty", delta: -40 },
        { kind: "adjustTrust", stakeholder: "gta_cohort", delta: -40 },
        { kind: "adjustMorale", rank: "adjunct", delta: -60 },
        { kind: "adjustMorale", rank: "gta", delta: -60 },
      ]),
    );
    const buried = { ...s, history: s.history.map((r) => ({ ...r, adminHoursUnspent: 0 })) };
    const e = computeEnding(buried, STANDARD_ARC);
    expect(e.id).toBe("rotated_out");
    expect(e.title).toBe("Rotated Out of the Program Office");
  });
});

describe("saves and exports", () => {
  it("round-trip a finished arc", () => {
    const s = finish(start());
    const loaded = parseSave(JSON.parse(JSON.stringify(createSave(s, "x", new Date()))), only, ARCS);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.session).toEqual(s);
  });

  it("open version 3 saves with an empty history", () => {
    const s = start();
    const v3 = JSON.parse(JSON.stringify(createSave(s, "x", new Date())));
    v3.version = 3;
    for (const k of ["history", "overtimeHours", "reports", "baseline"]) delete v3.session[k];
    const loaded = parseSave(v3, only, ARCS).session;
    expect(loaded.history).toEqual([]);
    expect(loaded.reports).toEqual([]);
    expect(loaded.baseline.totalSections).toBe(recordTerm(s).totalSections);
  });

  it("put reports and the ending in the Markdown case files", () => {
    const md = caseFilesToMarkdown(finish(start()), only, names, new Date("2026-09-27T00:00:00Z"));
    expect(md).toContain("## Year 1 annual report");
    expect(md).toContain("### Program data (the author's section)");
    expect(md).toContain("### Assessment and outcomes (fyw_director)");
    expect(md).toContain("## Year 3 annual report");
    expect(md).toContain("## How the arc ended");
    expect(md).toMatch(/\| Dissertation \| \d+(\.\d)? \/ 20 \|/);
  });
});
