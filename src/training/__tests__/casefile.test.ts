import { describe, expect, it } from "vitest";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS, scenarioById } from "../../content";
import {
  PORTFOLIO_NOTICE,
  addReflection,
  advanceTerm,
  caseFiles,
  caseFilesToMarkdown,
  createSave,
  parseSave,
  resolveScenario,
  setPortfolio,
  startSession,
  type Names,
  type TrainingSession,
} from "../index";

const names: Names = {
  short: (id) => ({ dean: "Dean Alvarez", chair: "Dr. Hale" })[id as "dean" | "chair"] ?? id,
  byline: (id) => ({ dean: "Elena Alvarez, Dean of Arts & Sciences", chair: "Marcus Hale, Chair" })[id as "dean" | "chair"] ?? id,
};

/** Fall: compromise at 25 with a memo. Spring: The Late Hire arrives (gap 2), resolved by adding seats. */
function played(): TrainingSession {
  let s = startSession(MIDLAND_STATE, SCENARIOS);
  s = resolveScenario(s, scenarioById("cap-memo")!, "compromise-25", {
    audience: "dean",
    subject: "A middle path on caps",
    ask: "Caps of 25 for one year.",
    body: "First paragraph.\n\nSecond paragraph.",
    evidenceIds: [],
    commitments: [{ text: "Report D/F/W after a year", dueInTerms: 2, effortHours: 4 }],
    selfAssessment: { ask: true },
  }).session;
  s = advanceTerm(s, SCENARIOS).session;
  return resolveScenario(s, scenarioById("late-hire")!, "add-seats", null).session;
}

describe("case files", () => {
  it("one per decision, in order, with the memo where there is one", () => {
    const files = caseFiles(played(), SCENARIOS);
    expect(files.map((f) => [f.index, f.scenario.id, f.option.id, Boolean(f.memo)])).toEqual([
      [1, "cap-memo", "compromise-25", true],
      [2, "late-hire", "add-seats", false],
    ]);
  });

  it("snapshot documents as they read at the time, with placeholders filled", () => {
    const lateHire = caseFiles(played(), SCENARIOS)[1]!;
    expect(lateHire.snapshot!.documents[0]!.body).toContain("no instructor for 2 sections of");
    expect(lateHire.snapshot!.changeDescriptions).toContain("ENGL102 cap 25 → 27");
  });

  it("reflections attach to the decision, and clearing one removes it", () => {
    let s = addReflection(played(), "cap-memo", "  I should have consulted adjuncts first.  ");
    expect(s.decisions[0]!.reflection).toBe("I should have consulted adjuncts first.");
    s = addReflection(s, "cap-memo", "   ");
    expect(s.decisions[0]!.reflection).toBeUndefined();
    expect(() => addReflection(s, "nope", "x")).toThrow();
  });

  it("export: cover, notice, contents, and every section of a case", () => {
    let s = setPortfolio(played(), { author: " Jordan Lee ", course: "ENGL 790" });
    s = addReflection(s, "cap-memo", "I'd bring data next time.");
    const md = caseFilesToMarkdown(s, SCENARIOS, names, new Date("2026-10-01T12:00:00Z"));
    for (const expected of [
      "# Administrative Case Files",
      "**Author:** Jordan Lee  ",
      "**Course:** ENGL 790  ",
      "**Exported:** 2026-10-01  ",
      `> ${PORTFOLIO_NOTICE}`,
      "1. The Cap Memo (Fall, Year 1)",
      "2. The Late Hire (Spring, Year 1)",
      "**From:** Elena Alvarez, Dean of Arts & Sciences  ",
      "> I'd like to raise caps in ENGL 101 and ENGL 102 from 24 to 27 beginning",
      "**Propose a compromise at 25.** Offer caps of 25 for one year while you study the effects.",
      "**The ask:** Caps of 25 for one year.",
      "First paragraph.\n\nSecond paragraph.",
      "- Report D/F/W after a year — open, due Fall, Year 2",
      "> — Dean Alvarez",
      "- Dean Alvarez: 55 → 58 (+3)",
      "- ENGL101 cap 24 → 25",
      "I'd bring data next time.",
      "_No reflection written._",
    ]) {
      expect(md).toContain(expected);
    }
  });

  it("older decisions without snapshots still export, with a note", () => {
    const s = played();
    const old = { ...s, decisions: s.decisions.map(({ snapshot: _s, ...d }) => d) };
    expect(caseFilesToMarkdown(old, SCENARIOS, names, new Date())).toContain("Details weren't recorded for this decision");
  });

  it("reflections and cover details survive a save", () => {
    const s = setPortfolio(addReflection(played(), "late-hire", "Adding seats felt fast but unfair."), { author: "J", course: "C" });
    const loaded = parseSave(JSON.parse(JSON.stringify(createSave(s, "x", new Date()))), SCENARIOS).session;
    expect(loaded.decisions[1]!.reflection).toBe("Adding seats felt fast but unfair.");
    expect(loaded.portfolio).toEqual({ author: "J", course: "C" });
  });
});
