import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../../content";
import { scenarioSummaries, studentSummary, summariesToCsv } from "../index";
import { avery, blake } from "../../test-fixtures/students";

describe("student summary", () => {
  it("counts decisions, writing, process, reflections, and commitments", () => {
    expect(studentSummary(avery())).toEqual({
      author: "Avery Chen",
      course: "ENGL 790",
      term: "Spring, Year 1",
      termIndex: 2,
      decisions: 1,
      memos: 1,
      memoWords: 6,
      draftingMinutes: 12,
      savedDrafts: 1,
      portfolioRevisions: 0,
      largeInsertions: 0,
      reflections: 1,
      reflectionWords: 4,
      commitmentsKept: 0,
      commitmentsMissed: 0,
      commitmentsOpen: 1,
    });
    expect(studentSummary(blake())).toMatchObject({ decisions: 1, memos: 0, reflections: 0, term: "Fall, Year 1" });
  });
});

describe("scenario summaries", () => {
  it("show how the class split, and who persuaded", () => {
    const summaries = scenarioSummaries(
      [{ name: "Avery Chen", session: avery() }, { name: "Blake Ortiz", session: blake() }],
      SCENARIOS,
    );
    const capMemo = summaries.find((x) => x.scenario.id === "cap-memo");
    const lateHire = summaries.find((x) => x.scenario.id === "late-hire");
    expect(capMemo!.responded).toBe(2);
    expect(capMemo!.options.find((o) => o.id === "accept")).toMatchObject({ count: 1, persuaded: null, students: ["Blake Ortiz"] });
    expect(capMemo!.options.find((o) => o.id === "counter-with-data")).toMatchObject({ count: 1, persuaded: 1, students: ["Avery Chen"] });
    expect(capMemo!.memos).toBe(1);
    expect(capMemo!.reflections).toBe(1);
    expect(lateHire!.responded).toBe(0);
  });
});

describe("CSV", () => {
  it("has a header row and quotes cells that need it", () => {
    const csv = summariesToCsv([{ file: "chen, avery.json", summary: studentSummary(avery()) }]);
    const [header, row] = csv.split("\n");
    expect(header).toBe(
      "File,Name,Course,Reached,Decisions,Memos,Memo words,Drafting minutes,Saved drafts,Portfolio revisions,Large insertions,Reflections,Reflection words,Commitments kept,Commitments missed,Commitments open",
    );
    expect(row).toBe('"chen, avery.json",Avery Chen,ENGL 790,"Spring, Year 1",1,1,6,12,1,0,0,1,4,0,0,1');
  });
});
