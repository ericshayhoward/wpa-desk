import { describe, expect, it } from "vitest";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS, scenarioById } from "../../content";
import { SAVE_VERSION, advanceTerm, createSave, parseSave, resolveScenario, startSession } from "../index";

function midGame() {
  let s = startSession(MIDLAND_STATE, SCENARIOS);
  s = resolveScenario(s, scenarioById("cap-memo")!, "compromise-25", {
    audience: "dean", subject: "S", ask: "A", body: "B", evidenceIds: [],
    commitments: [{ text: "Report back", dueInTerms: 2, effortHours: 4 }], selfAssessment: { ask: true },
  }).session;
  return advanceTerm(s, SCENARIOS).session;
}

const roundTrip = (x: unknown) => JSON.parse(JSON.stringify(x));

describe("save files", () => {
  it("round-trip a mid-game session exactly", () => {
    const s = midGame();
    const loaded = parseSave(roundTrip(createSave(s, "Test", new Date("2026-09-27T12:00:00Z"))), SCENARIOS);
    expect(loaded.session).toEqual(s);
    expect(loaded.summary).toEqual({ institution: "Midland State University", term: "Spring, Year 1", decisions: 1, memos: 1 });
    expect(loaded.version).toBe(SAVE_VERSION);
  });

  it("don't share state with the live session", () => {
    const s = startSession(MIDLAND_STATE, SCENARIOS);
    const save = createSave(s, "Test", new Date());
    save.session.program.policies.caps.ENGL101 = 99;
    expect(s.program.policies.caps.ENGL101).toBe(24);
  });

  const valid = () => roundTrip(createSave(midGame(), "Test", new Date()));

  it("reject files that aren't saves", () => {
    expect(() => parseSave({ hello: "world" }, SCENARIOS)).toThrow("This isn't a WPA Desk save file.");
    expect(() => parseSave([], SCENARIOS)).toThrow(/expected format/);
  });

  it("reject saves from a newer version", () => {
    const f = valid();
    f.version = SAVE_VERSION + 1;
    expect(() => parseSave(f, SCENARIOS)).toThrow(/newer version of WPA Desk/);
  });

  it("reject references to unknown scenarios", () => {
    const f = valid();
    f.session.inbox = ["the-detector"];
    expect(() => parseSave(f, SCENARIOS)).toThrow(/scenario this version doesn't have \(inbox: the-detector\)/);
  });

  it("reject a damaged program with the model's own reason", () => {
    const f = valid();
    f.session.program.policies.caps.ENGL101 = 0;
    expect(() => parseSave(f, SCENARIOS)).toThrow(/damaged: No valid cap for course ENGL101/);
  });

  it("reject damaged session fields", () => {
    const f = valid();
    f.session.termIndex = "two";
    expect(() => parseSave(f, SCENARIOS)).toThrow(/invalid termIndex/);
  });
});
