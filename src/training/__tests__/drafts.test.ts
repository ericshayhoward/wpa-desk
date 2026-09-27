import { describe, expect, it } from "vitest";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS, scenarioById } from "../../content";
import {
  addReflection,
  caseFilesToMarkdown,
  createSave,
  diffToMarkdown,
  draftingMinutes,
  latestRevision,
  parseSave,
  resolveScenario,
  reviseMemo,
  setDraftInProgress,
  snapshot,
  startSession,
  wordDiff,
  type DraftVersion,
  type MemoDraft,
} from "../index";

const t = (min: number) => new Date(Date.UTC(2026, 8, 27, 14, min));
const c = (body: string, subject = "Caps", ask = "Hold at 24.") => ({ subject, ask, body });

describe("word diff", () => {
  it("marks added and removed words, keeping spacing", () => {
    expect(wordDiff("the dean wants caps", "the dean wants higher caps now")).toEqual([
      { type: "same", text: "the dean wants " },
      { type: "added", text: "higher " },
      { type: "same", text: "caps" },
      { type: "added", text: " now" },
    ]);
    expect(diffToMarkdown(wordDiff("we should raise caps", "we should hold caps"))).toBe("we should ~~raise~~ **hold** caps");
  });

  it("treats punctuation separately from words", () => {
    expect(diffToMarkdown(wordDiff("First try.", "First try, now with numbers."))).toBe("First try**, now with numbers**.");
  });

  it("handles empty sides", () => {
    expect(wordDiff("", "new text")).toEqual([{ type: "added", text: "new text" }]);
    expect(wordDiff("old", "")).toEqual([{ type: "removed", text: "old" }]);
  });
});

describe("snapshots", () => {
  it("skip unchanged content, except saved drafts with notes and the sent version", () => {
    let h: DraftVersion[] = snapshot([], c("One."), "pause", t(0));
    h = snapshot(h, c("One."), "pause", t(1));
    expect(h).toHaveLength(1);
    h = snapshot(h, c("One."), "draft", t(2), "Checked tone");
    h = snapshot(h, c("One."), "sent", t(3));
    expect(h.map((v) => v.reason)).toEqual(["pause", "draft", "sent"]);
    expect(h[1]!.note).toBe("Checked tone");
    expect(draftingMinutes(t(0).toISOString(), h)).toBe(3);
  });
});

function sentMemo() {
  const start = startSession(MIDLAND_STATE, SCENARIOS);
  let history = snapshot([], c("First try."), "draft", t(0), "Rough start");
  history = snapshot(history, c("First try, now with numbers."), "large-change", t(5));
  history = snapshot(history, c("A stronger case, now with numbers."), "sent", t(9));
  const draft: MemoDraft = {
    audience: "dean", subject: "Caps", ask: "Hold at 24.", body: "A stronger case, now with numbers.",
    evidenceIds: [], commitments: [], selfAssessment: {}, history, startedAt: t(0).toISOString(),
  };
  const withDraft = setDraftInProgress(start, "cap-memo", { optionId: "counter-with-data", startedAt: draft.startedAt!, draft, history });
  expect(withDraft.drafts!["cap-memo"]).toBeDefined();
  return resolveScenario(withDraft, scenarioById("cap-memo")!, "counter-with-data", draft).session;
}

describe("memos keep their history", () => {
  it("sending files the history and clears the draft in progress", () => {
    const s = sentMemo();
    expect(s.drafts!["cap-memo"]).toBeUndefined();
    expect(s.dossier[0]!.history!.map((v) => v.reason)).toEqual(["draft", "large-change", "sent"]);
    expect(s.dossier[0]!.startedAt).toBe(t(0).toISOString());
  });

  it("portfolio revisions add to history; the sent version stays", () => {
    const s = reviseMemo(sentMemo(), "memo-1", c("A stronger, shorter case."), "Cut repetition after the debrief", t(30));
    const m = s.dossier[0]!;
    expect(m.body).toBe("A stronger case, now with numbers.");
    expect(latestRevision(m.history)).toMatchObject({ reason: "revision", body: "A stronger, shorter case.", note: "Cut repetition after the debrief" });
  });

  it("reflections keep a history of changed versions only", () => {
    let s = addReflection(sentMemo(), "cap-memo", "First thought.", t(40));
    s = addReflection(s, "cap-memo", "First thought.", t(41));
    s = addReflection(s, "cap-memo", "Second, better thought.", t(45));
    expect(s.decisions[0]!.reflectionHistory!.map((v) => v.text)).toEqual(["First thought.", "Second, better thought."]);
  });

  it("export shows the timeline, changes, revision, and reflection history", () => {
    let s = reviseMemo(sentMemo(), "memo-1", c("A stronger, shorter case."), "Cut repetition", t(30));
    s = addReflection(addReflection(s, "cap-memo", "First thought.", t(40)), "cap-memo", "Better thought.", t(45));
    const md = caseFilesToMarkdown(s, SCENARIOS, { short: (id) => id, byline: (id) => id }, t(50));
    for (const expected of [
      "#### Drafting history",
      "4 versions; 9 minutes from opening the memo to sending it.",
      "| 1 | 2026-09-27 14:00 | Saved draft | 2 | Rough start |",
      "| 2 | 2026-09-27 14:05 | Large insertion | 5 (+3) |  |",
      "| 4 | 2026-09-27 14:30 | Portfolio revision | 4 (−2) | Cut repetition |",
      "First try**, now with numbers**.",
      "#### Portfolio revision",
      "**Revision note:** Cut repetition",
      "#### Reflection history",
      "~~First~~ **Better** thought.",
    ]) {
      expect(md).toContain(expected);
    }
  });

  it("history and drafts in progress survive a save", () => {
    const s = setDraftInProgress(sentMemo(), "late-hire", {
      optionId: "emergency-hire", startedAt: t(60).toISOString(),
      draft: { audience: "dean", subject: "S", ask: "", body: "half", evidenceIds: [], commitments: [], selfAssessment: {} },
      history: [],
    });
    const loaded = parseSave(JSON.parse(JSON.stringify(createSave(s, "x", t(61)))), SCENARIOS).session;
    expect(loaded.dossier[0]!.history).toHaveLength(3);
    expect(loaded.drafts!["late-hire"]!.draft.body).toBe("half");
  });
});
