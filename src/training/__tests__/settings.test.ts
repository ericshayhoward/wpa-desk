import { describe, expect, it } from "vitest";
import { MIDLAND_STATE, applyChanges } from "../../model";
import { ARCS, SCENARIOS, STANDARD_ARC, scenarioById } from "../../content";
import {
  DEFAULT_SETTINGS,
  createSave,
  fillTemplate,
  parseSave,
  parseScenario,
  resolveScenario,
  startSession,
} from "../index";

describe("placeholders", () => {
  it("state The Cap Memo's numbers from the program, so they stay true when it varies", () => {
    const capMemo = scenarioById("cap-memo")!;
    const body = (p = MIDLAND_STATE) => fillTemplate(capMemo.documents[1]!.body, startSession(p, SCENARIOS));
    expect(body()).toContain("running about\n$8,600 over its instruction line");
    expect(body()).toContain("from 24 to 27");
    expect(body(applyChanges(MIDLAND_STATE, [{ kind: "adjustBudget", delta: -3000 }]))).toContain("$11,600 over");
    // A lower cap means more sections, so the deficit grows too.
    const lowerCap = body(applyChanges(MIDLAND_STATE, [{ kind: "setCap", courseId: "ENGL101", cap: 23 }]));
    expect(lowerCap).toContain("from 23 to 27");
    expect(lowerCap).toContain("$19,400 over");
  });

  it("are filled in consequences, replies, and delayed notes as things stood at the decision", () => {
    const s = parseScenario({
      id: "t",
      title: "T",
      stages: ["wpa"],
      documents: [{ from: "dean", genre: "memo", subject: "S", body: "B" }],
      options: [
        {
          id: "a",
          label: "A",
          description: "A",
          consequence: {
            narrative: "The deficit was {{deficit}}.",
            response: { from: "dean", body: "Caps stay at {{cap_ENGL102}}." },
            delayed: [{ inTerms: 1, note: "Back when it was {{deficit}}.", changes: [] }],
            changes: [{ kind: "adjustBudget", delta: 8600 }],
          },
        },
        { id: "b", label: "B", description: "B", consequence: { narrative: "B" } },
      ],
      debrief: { weighs: ["W"] },
    });
    const r = resolveScenario(startSession(MIDLAND_STATE, [s]), s, "a", null);
    expect(r.outcome.consequence.narrative).toBe("The deficit was $8,600.");
    expect(r.outcome.reply!.body).toBe("Caps stay at 24.");
    expect(r.session.pending[0]!.note).toBe("Back when it was $8,600.");
    expect(r.session.decisions[0]!.snapshot!.narrative).toBe("The deficit was $8,600.");
  });

  it("are left visible when unknown, so authoring mistakes show", () => {
    expect(fillTemplate("{{cap_ENGL999}} and {{nope}}", startSession(MIDLAND_STATE, []))).toBe("{{cap_ENGL999}} and {{nope}}");
  });
});

describe("session settings", () => {
  it("default, and are kept in saves", () => {
    const s = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
    expect(s.settings).toEqual(DEFAULT_SETTINGS);
    const custom = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC, { id: "engl790-fall", label: "ENGL 790, Fall" });
    const loaded = parseSave(JSON.parse(JSON.stringify(createSave(custom, "x", new Date()))), SCENARIOS, ARCS);
    expect(loaded.session.settings).toEqual({ id: "engl790-fall", label: "ENGL 790, Fall" });
  });

  it("are added to version 4 saves as the defaults", () => {
    const v4 = JSON.parse(JSON.stringify(createSave(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "x", new Date())));
    v4.version = 4;
    delete v4.session.settings;
    expect(parseSave(v4, SCENARIOS, ARCS).session.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("reject damaged settings", () => {
    const f = JSON.parse(JSON.stringify(createSave(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "x", new Date())));
    f.session.settings = { id: 3 };
    expect(() => parseSave(f, SCENARIOS, ARCS)).toThrow("The saved settings are damaged.");
  });
});
