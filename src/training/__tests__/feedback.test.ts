import { describe, expect, it } from "vitest";
import { MIDLAND_STATE, applyChanges, type ProgramChange } from "../../model";
import { CAST, SCENARIOS, STANDARD_ARC, scenarioById } from "../../content";
import { advanceTerm, caseFilesToMarkdown, computeEnding, resolveScenario, startSession, type TrainingSession } from "../index";
import { closeOutTerm } from "../../test-fixtures/reports";

const capMemo = scenarioById("cap-memo")!;
const only = [capMemo];

function finish(choice: string, changes: ProgramChange[] = []): TrainingSession {
  let s = startSession(applyChanges(MIDLAND_STATE, changes), only, STANDARD_ARC);
  s = resolveScenario(s, capMemo, choice, null, CAST).session;
  while (s.termIndex < 6) s = advanceTerm(closeOutTerm(s), only, STANDARD_ARC).session;
  return closeOutTerm(s);
}
const strong: ProgramChange[] = [
  { kind: "adjustTrust", stakeholder: "fyw_director", delta: 35 },
  { kind: "adjustTrust", stakeholder: "dean", delta: 30 },
  { kind: "adjustTrust", stakeholder: "chair", delta: 25 },
  { kind: "adjustTrust", stakeholder: "provost_office", delta: 30 },
  { kind: "adjustTrust", stakeholder: "writing_center", delta: 20 },
  { kind: "adjustTrust", stakeholder: "adjunct_faculty", delta: 40 },
  { kind: "adjustTrust", stakeholder: "gta_cohort", delta: 30 },
];
const item = (s: TrainingSession, id: string, list: "workOn" | "didWell" = "workOn") => s.ending![list]!.find((f) => f.factorId === id);

describe("ending feedback", () => {
  it("names what to work on, weakest first, with the player's own decisions", () => {
    const s = finish("accept", [{ kind: "adjustTrust", stakeholder: "fyw_director", delta: -25 }]);
    const work = s.ending!.workOn!;
    expect(work.length).toBeGreaterThan(0);
    const letter = item(s, "recommender")!;
    expect(letter.text).toMatch(/Your supervisor's trust ended at \d+\. That letter is the one search committees read most closely/);
    expect(letter.text).toMatch(/it will be careful and polite, which committees read as a warning/);
    // Accepting cost Dr. Cherry only 2 trust, too small to name as a cause.
    expect(letter.text).not.toMatch(/Accept the increase/);
    const instructors = item(s, "instructors")!;
    expect(instructors.text).toMatch(/The Cap Memo, where you chose "Accept the increase" \(−\d+ trust\)/);
  });

  it("says plainly when there's no record of follow-through", () => {
    expect(item(finish("accept"), "commitments")!.text).toMatch(/You never made a commitment in a memo/);
  });

  it("explains the dissertation gate with the numbers, and what to do differently", () => {
    const s = finish("compromise-25", strong);
    const behind = { ...s, history: s.history.map((r) => ({ ...r, adminHoursUnspent: 29 })) };
    const e = computeEnding(behind, STANDARD_ARC, only);
    expect(e.id).toBe("two_year");
    expect(e.gateNote).toMatch(/174 of the 180 hours needed to be on track/);
    expect(e.gateNote).toMatch(/the dissertation is why the offer didn't come/);
    const d = e.workOn!.find((f) => f.factorId === "dissertation")!;
    expect(d.text).toMatch(/Your dissertation is 73% done: 174 of the 240 hours it needs\. To stay on track you needed about 30 unspent hours a term/);
    expect(d.text).toMatch(/Decide what the dissertation gets each term first/);
  });

  it("doesn't flatter a finished dissertation when the job didn't get the time it needed", () => {
    const s = finish("accept", [
      { kind: "adjustTrust", stakeholder: "fyw_director", delta: -30 },
      { kind: "adjustTrust", stakeholder: "adjunct_faculty", delta: -30 },
      { kind: "adjustTrust", stakeholder: "dean", delta: -30 },
    ]);
    expect(s.ending!.workOn!.length).toBeGreaterThanOrEqual(3);
    expect(item(s, "dissertation", "didWell")!.text).toMatch(/Be honest with yourself about why/);
  });

  it("recognizes real strengths", () => {
    const s = finish("compromise-25", strong);
    expect(item(s, "recommender", "didWell")!.text).toMatch(/That letter will be a strong one/);
  });

  it("goes into the exported case files", () => {
    const md = caseFilesToMarkdown(finish("accept"), SCENARIOS, { short: (x) => x, byline: (x) => x }, new Date());
    expect(md).toContain("### What you need to work on");
    expect(md).toContain("### The score");
  });
});
