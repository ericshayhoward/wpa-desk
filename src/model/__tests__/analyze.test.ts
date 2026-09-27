import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSUMPTIONS,
  MIDLAND_STATE,
  analyzeTerm,
  rangeLabel,
  applyChanges,
  compareTerms,
} from "../index";

const A = DEFAULT_ASSUMPTIONS;

describe("Midland State baseline", () => {
  const fall = analyzeTerm(MIDLAND_STATE, "fall", A);
  const staffing = (rank: string) => fall.staffing.find((s) => s.rank === rank)!;

  it("needs 60 sections each term", () => {
    expect(fall.totalSections).toBe(60);
    expect(analyzeTerm(MIDLAND_STATE, "spring", A).totalSections).toBe(60);
  });

  it("fills sections full-time first, then GTAs, then adjuncts", () => {
    expect(staffing("tt").sectionsAssigned).toBe(3);
    expect(staffing("ntt").sectionsAssigned).toBe(6);
    expect(staffing("gta").sectionsAssigned).toBe(15);
    expect(staffing("adjunct").sectionsAssigned).toBe(36);
    expect(staffing("adjunct").peopleWithoutSections).toBe(2);
    expect(fall.unstaffedSections).toBe(0);
  });

  it("runs a small deficit, which is what triggers The Cap Memo", () => {
    expect(fall.cost.program).toBe(303_600);
    expect(fall.cost.department).toBe(58_500);
    expect(fall.budgetBalance).toBe(-8_600);
  });

  it("reports baseline D/F/W unchanged at baseline section sizes", () => {
    const engl101 = fall.courses.find((c) => c.courseId === "ENGL101")!;
    expect(engl101.dfw.mid).toBeCloseTo(0.18);
    expect(engl101.dfw.low).toBeCloseTo(0.18);
    expect(engl101.dfw.high).toBeCloseTo(0.18);
  });

  it("estimates feedback load as a range", () => {
    const adj = staffing("adjunct");
    expect(adj.studentsPerFullLoad).toBe(69); // 3 sections × average 23
    expect(adj.feedbackHoursPerFullLoad.mid).toBeCloseTo(115);
    expect(adj.feedbackHoursPerFullLoad.low).toBeLessThan(adj.feedbackHoursPerFullLoad.high);
  });
});

describe("The Cap Memo: raising Composition I and II caps to 27", () => {
  const raised = applyChanges(MIDLAND_STATE, [
    { kind: "setCap", courseId: "ENGL101", cap: 27 },
    { kind: "setCap", courseId: "ENGL102", cap: 27 },
  ]);
  const before = analyzeTerm(MIDLAND_STATE, "fall", A);
  const after = analyzeTerm(raised, "fall", A);
  const diff = compareTerms(before, after);

  it("does not mutate the original program", () => {
    expect(MIDLAND_STATE.policies.caps.ENGL101).toBe(24);
  });

  it("cuts sections, and the cuts land on adjuncts", () => {
    expect(after.totalSections).toBe(55);
    expect(diff.sectionsByRank.adjunct).toBe(-5);
    expect(diff.sectionsByRank.gta).toBe(0);
    expect(diff.peopleWithoutSectionsByRank.adjunct).toBeGreaterThan(0);
  });

  it("closes the deficit", () => {
    expect(diff.programCost).toBe(-18_000);
    expect(after.budgetBalance).toBe(9_400);
  });

  it("raises projected D/F/W, with uncertainty", () => {
    expect(diff.dfwMid).toBeGreaterThan(0);
    const engl101 = after.courses.find((c) => c.courseId === "ENGL101")!;
    expect(engl101.dfw.low).toBeLessThan(engl101.dfw.mid);
    expect(engl101.dfw.mid).toBeLessThan(engl101.dfw.high);
    expect(after.trace.some((line) => line.startsWith("ENGL101:"))).toBe(true);
  });
});

describe("cap changes that don't change the section count", () => {
  const spring = (caps: Record<string, number>) =>
    analyzeTerm(
      applyChanges(MIDLAND_STATE, Object.entries(caps).map(([courseId, cap]) => ({ kind: "setCap" as const, courseId, cap }))),
      "spring",
      A,
    );
  const base = analyzeTerm(MIDLAND_STATE, "spring", A);

  it("explains a spring ENGL101 cap of 26 saving nothing, and what would", () => {
    const after = spring({ ENGL101: 26 });
    const diff = compareTerms(base, after);
    expect(diff.sections).toBe(0);
    expect(after.courses.find((c) => c.courseId === "ENGL101")!.exactSections).toBeCloseTo(240 / 26);
    expect(diff.courseNotes).toEqual([
      "ENGL101: 240 seats at a cap of 26 is 9.2 sections' worth, which still takes 10 whole sections, " +
        "so cost and class size don't change. A cap of 27 would be needed to drop one section.",
    ]);
  });

  it("stays quiet when the section count does change", () => {
    expect(compareTerms(base, spring({ ENGL101: 27 })).courseNotes).toEqual([]);
  });

  it("explains a lowered cap that still fits", () => {
    // 230 seats at 24 is 9.6 → 10 sections; at 23 it's exactly 10, so no extra section.
    const p = applyChanges(MIDLAND_STATE, [{ kind: "scaleSeatDemand", courseId: "ENGL101", factor: 230 / 240, terms: ["spring"] }]);
    const lowered = applyChanges(p, [{ kind: "setCap", courseId: "ENGL101", cap: 23 }]);
    const notes = compareTerms(analyzeTerm(p, "spring", A), analyzeTerm(lowered, "spring", A)).courseNotes;
    expect(notes[0]).toMatch(/ENGL101: 230 seats at a cap of 23 is 10\.0 sections' worth/);
    expect(notes[0]).toMatch(/A cap of 22 or lower would require an extra section\./);
  });
});

describe("applyChanges", () => {
  it("rejects nonsense values", () => {
    expect(() => applyChanges(MIDLAND_STATE, [{ kind: "setCap", courseId: "all", cap: 0 }])).toThrow();
    expect(() => applyChanges(MIDLAND_STATE, [{ kind: "setCap", courseId: "NOPE", cap: 20 }])).toThrow();
  });

  it("flags unstaffed sections when demand outgrows the instructor pool", () => {
    const surge = applyChanges(MIDLAND_STATE, [{ kind: "scaleSeatDemand", courseId: "all", factor: 1.3 }]);
    expect(analyzeTerm(surge, "fall", A).unstaffedSections).toBeGreaterThan(0);
  });

  it("models a dual-enrollment drop as lost adjunct work", () => {
    const drop = applyChanges(MIDLAND_STATE, [
      { kind: "scaleSeatDemand", courseId: "ENGL101", factor: 0.7, terms: ["fall"] },
    ]);
    const diff = compareTerms(analyzeTerm(MIDLAND_STATE, "fall", A), analyzeTerm(drop, "fall", A));
    expect(diff.sectionsByRank.adjunct).toBeLessThan(0);
  });

  it("clamps stakeholder trust to 0–100", () => {
    const p = applyChanges(MIDLAND_STATE, [{ kind: "adjustTrust", stakeholder: "dean", delta: 500 }]);
    expect(p.stakeholders.find((s) => s.id === "dean")!.trust).toBe(100);
  });
});

describe("rangeLabel", () => {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  it("shows both ends of a real range", () => {
    expect(rangeLabel({ low: 0.183, high: 0.211 }, pct)).toBe("18.3%–21.1%");
  });
  it("shows one value when the range collapses at display precision", () => {
    expect(rangeLabel({ low: 0.1830001, high: 0.1830004 }, pct)).toBe("18.3%");
  });
});

describe("one-term budget changes", () => {
  it("move only that term's budget, and undo cleanly", () => {
    const covered = applyChanges(MIDLAND_STATE, [{ kind: "adjustBudget", term: "fall", delta: 5000 }]);
    const fall = (p: typeof MIDLAND_STATE) => analyzeTerm(p, "fall", DEFAULT_ASSUMPTIONS).budgetBalance;
    const spring = (p: typeof MIDLAND_STATE) => analyzeTerm(p, "spring", DEFAULT_ASSUMPTIONS).budgetBalance;
    expect(fall(covered)).toBe(fall(MIDLAND_STATE) + 5000);
    expect(spring(covered)).toBe(spring(MIDLAND_STATE));
    const undone = applyChanges(covered, [{ kind: "adjustBudget", term: "fall", delta: -5000 }]);
    expect(undone.budgetByTerm).toBeUndefined();
  });
});
