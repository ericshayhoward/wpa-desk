import { expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges, type ProgramChange } from "../../model";
import { staffingPlanEvidence } from "../index";

it("summarizes a staffing plan in memo-ready lines", () => {
  const gap = applyChanges(MIDLAND_STATE, [
    { kind: "adjustHeadcount", rank: "adjunct", delta: -3 },
    { kind: "setOverload", rank: "ntt", maxPerPerson: 1, costPerSection: 3600 },
  ]);
  const plan: ProgramChange[] = [
    { kind: "adjustHeadcount", rank: "adjunct", delta: 1 },
  ];
  const ev = staffingPlanEvidence(gap, plan, analyzeTerm(gap, "fall", A), analyzeTerm(applyChanges(gap, plan), "fall", A));
  expect(ev.kind).toBe("staffing_plan");
  expect(ev.label).toBe("Staffing plan: Add 1 adjunct faculty (11 → 12) (Fall)");
  expect(ev.summary).toContain("Unstaffed sections: 1 → 0.");
  expect(ev.summary).toContain("Adjunct faculty: 33 → 36 sections.");
  expect(ev.summary).toContain("Full-time non-tenure-track: 8 → 6 sections (overloads 2 → 0).");
});
