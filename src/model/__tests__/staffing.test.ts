import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSUMPTIONS as A,
  MIDLAND_STATE,
  analyzeTerm,
  applyChanges,
  compareTerms,
  describeChange,
  parseChange,
  type ProgramChange,
} from "../index";

const fall = (changes: ProgramChange[] = []) => analyzeTerm(applyChanges(MIDLAND_STATE, changes), "fall", A);
const rank = (a: ReturnType<typeof fall>, r: string) => a.staffing.find((s) => s.rank === r)!;

const ALLOW_OVERLOADS: ProgramChange = { kind: "setOverload", rank: "ntt", maxPerPerson: 1, costPerSection: 3600 };
const LOSE_THREE: ProgramChange = { kind: "adjustHeadcount", rank: "adjunct", delta: -3 };

describe("overloads", () => {
  it("are off until someone asks", () => {
    expect(rank(fall(), "ntt").overloadCapacity).toBe(0);
    expect(fall([LOSE_THREE]).unstaffedSections).toBe(3);
  });

  it("are not used while regular loads have room", () => {
    const a = fall([ALLOW_OVERLOADS]);
    expect(rank(a, "ntt").overloadSections).toBe(0);
    expect(rank(a, "ntt").overloadCapacity).toBe(2);
  });

  it("cover a gap only after every regular load is full, at the overload rate", () => {
    // Three adjuncts leave: 33 adjunct sections for 36 needed.
    const a = fall([LOSE_THREE, ALLOW_OVERLOADS]);
    expect(rank(a, "adjunct").sectionsAssigned).toBe(33);
    expect(rank(a, "ntt").overloadSections).toBe(2);
    expect(rank(a, "ntt").sectionsAssigned).toBe(8);
    expect(rank(a, "ntt").cost).toBe(6 * 6500 + 2 * 3600);
    expect(a.unstaffedSections).toBe(1);
    expect(a.trace.some((l) => l.includes("overload"))).toBe(true);
  });

  it("can be switched off again", () => {
    const a = fall([LOSE_THREE, ALLOW_OVERLOADS, { kind: "setOverload", rank: "ntt", maxPerPerson: 0, costPerSection: 0 }]);
    expect(a.unstaffedSections).toBe(3);
  });
});

describe("cancelled sections", () => {
  it("close a gap but leave students without a seat", () => {
    const a = fall([LOSE_THREE, ALLOW_OVERLOADS, { kind: "cancelSections", courseId: "ENGL101", term: "fall", sections: 1 }]);
    const engl101 = a.courses.find((c) => c.courseId === "ENGL101")!;
    expect(engl101.sectionsNeeded).toBe(48);
    expect(engl101.sections).toBe(47);
    expect(engl101.seatsUnserved).toBe(24);
    expect(a.totalSeatsUnserved).toBe(24);
    expect(a.unstaffedSections).toBe(0);
  });

  it("only apply to their term, and 0 restores them", () => {
    const cancelled = applyChanges(MIDLAND_STATE, [{ kind: "cancelSections", courseId: "ENGL101", term: "fall", sections: 2 }]);
    expect(analyzeTerm(cancelled, "spring", A).totalSectionsCancelled).toBe(0);
    const restored = applyChanges(cancelled, [{ kind: "cancelSections", courseId: "ENGL101", term: "fall", sections: 0 }]);
    expect(restored.cancellations).toEqual([]);
  });

  it("can't exceed the sections a course needs", () => {
    const a = fall([{ kind: "cancelSections", courseId: "ENGL102", term: "fall", sections: 9 }]);
    expect(a.courses.find((c) => c.courseId === "ENGL102")!.sectionsCancelled).toBe(2);
  });

  it("are reported by compareTerms", () => {
    const d = compareTerms(fall(), fall([{ kind: "cancelSections", courseId: "ENGL101", term: "fall", sections: 1 }]));
    expect(d.seatsUnserved).toBe(24);
    expect(d.sectionsByRank.adjunct).toBe(-1);
  });
});

describe("change vocabulary", () => {
  it("parses the new staffing changes from content", () => {
    expect(parseChange({ kind: "setOverload", rank: "ntt", maxPerPerson: 1, costPerSection: 4000 })).toEqual({
      kind: "setOverload", rank: "ntt", maxPerPerson: 1, costPerSection: 4000,
    });
    expect(() => parseChange({ kind: "cancelSections", courseId: "ENGL101", term: "summer", sections: 1 })).toThrow(/fall or spring/);
  });

  it("adjustCap composes with the current cap", () => {
    const p = applyChanges(MIDLAND_STATE, [
      { kind: "setCap", courseId: "ENGL102", cap: 25 },
      { kind: "adjustCap", courseId: "ENGL102", delta: 2 },
    ]);
    expect(p.policies.caps.ENGL102).toBe(27);
    expect(describeChange(MIDLAND_STATE, { kind: "adjustCap", courseId: "ENGL102", delta: 2 })).toBe("ENGL102 cap 24 → 26");
  });

  it("describes changes in plain language", () => {
    const d = (c: ProgramChange) => describeChange(MIDLAND_STATE, c);
    expect(d({ kind: "adjustHeadcount", rank: "adjunct", delta: 2 })).toBe("Add 2 adjunct faculty (14 → 16)");
    expect(d({ kind: "setCap", courseId: "ENGL101", cap: 27 })).toBe("ENGL101 cap 24 → 27");
    expect(d({ kind: "cancelSections", courseId: "ENGL101", term: "fall", sections: 1 })).toBe("Cancel 1 ENGL101 section (fall)");
    expect(d({ kind: "setOverload", rank: "ntt", maxPerPerson: 1, costPerSection: 3600 })).toBe(
      "Up to 1 overload section per person for full-time non-tenure-track at $3,600",
    );
  });
});
