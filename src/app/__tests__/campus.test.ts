import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, MIDLAND_STATE, STAKEHOLDER_IDS, analyzeTerm, type Program } from "../../model";
import { SCENARIOS, STANDARD_ARC } from "../../content";
import { MORALE_ATTRITION, startSession, termOf, type TrainingSession } from "../../training";
import {
  BUILDINGS,
  DAY,
  FOUNDERS_WINDOWS,
  buildingOf,
  buildingTrust,
  campusLife,
  dayClock,
  foundersWindows,
  skyAt,
  trustBand,
  waitingByBuilding,
} from "../campus";

const fresh = () => startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
const analysisOf = (s: TrainingSession) => analyzeTerm(s.program, termOf(s.termIndex), DEFAULT_ASSUMPTIONS);
const withProgram = (s: TrainingSession, p: Partial<Program>): TrainingSession => ({ ...s, program: { ...s.program, ...p } });

describe("campus buildings", () => {
  it("houses every stakeholder in exactly one building", () => {
    for (const id of STAKEHOLDER_IDS) {
      expect(BUILDINGS.filter((b) => b.occupants.includes(id)), id).toHaveLength(1);
    }
    expect(buildingOf("dean")).toBe("arts_sciences");
    expect(buildingOf("fyw_director")).toBe("humanities");
  });

  it("flies the weakest relationship inside, in the People card's bands", () => {
    const s = fresh();
    const lowest = Math.min(...s.program.stakeholders.filter((x) => buildingOf(x.id) === "humanities").map((x) => x.trust));
    expect(buildingTrust(s, "humanities")).toBe(lowest);
    expect(buildingTrust(s, "founders")).toBeNull();
    expect([trustBand(20), trustBand(50), trustBand(80)]).toEqual(["low", "mid", "high"]);
  });
});

describe("the day runs on admin hours", () => {
  it("starts in the morning and ends at night as hours are spent", () => {
    const s = fresh();
    expect(dayClock(s)).toMatchObject({ hour: DAY.start, label: "morning", spent: 0 });
    expect(dayClock({ ...s, adminHoursRemaining: s.adminHoursPerTerm / 2 }).hour).toBe((DAY.start + DAY.end) / 2);
    expect(dayClock({ ...s, adminHoursRemaining: 0 })).toMatchObject({ hour: DAY.end, label: "night" });
  });

  it("runs past ten when the player works overtime, and holds commencement at the end", () => {
    const s = fresh();
    expect(dayClock({ ...s, adminHoursRemaining: 0, overtimeHours: 12 }).label).toBe("after midnight");
    expect(dayClock({ ...s, ending: {} as TrainingSession["ending"] }).label).toBe("Commencement");
  });

  it("darkens the sky only after late afternoon", () => {
    expect(skyAt(DAY.start).darkness).toBe(0);
    expect(skyAt(16).darkness).toBe(0);
    expect(skyAt(DAY.end).darkness).toBe(1);
    expect(skyAt(19).darkness).toBeGreaterThan(0);
  });
});

describe("what's waiting, and where", () => {
  it("puts each inbox item at its sender's building", () => {
    const s = fresh();
    const waiting = waitingByBuilding(s, SCENARIOS);
    expect(waiting.get("humanities")?.map((w) => w.id).sort()).toEqual([...s.inbox].sort());
    expect(waiting.get("humanities")?.[0]?.subject).not.toContain("{{");
  });

  it("puts uncovered sections at Founders Hall and the report with whoever asked for it", () => {
    const s = fresh();
    const spec = STANDARD_ARC.yearEnd!.find((r) => r.term === 2) ?? STANDARD_ARC.yearEnd![0]!;
    const waiting = waitingByBuilding(s, SCENARIOS, spec, { unstaffed: 3 });
    expect(waiting.get("founders")).toEqual([expect.objectContaining({ kind: "staffing", urgent: true })]);
    expect(waiting.get(buildingOf(spec.request.from))).toContainEqual(expect.objectContaining({ kind: "report" }));
  });
});

describe("Founders Hall's windows", () => {
  it("shows one window per section, by rank, then unstaffed and cancelled", () => {
    const s = withProgram(fresh(), { cancellations: [{ courseId: "ENGL102", term: "fall", sections: 1 }] });
    const a = analysisOf(s);
    const { kinds, perWindow } = foundersWindows(a);
    expect(perWindow).toBe(1);
    expect(kinds).toHaveLength(a.totalSections + a.totalSectionsCancelled);
    expect(kinds.filter((k) => k === "adjunct")).toHaveLength(a.staffing.find((l) => l.rank === "adjunct")!.sectionsAssigned);
    expect(kinds.at(-1)).toBe("cancelled");
    expect(kinds.indexOf("tt")).toBe(0);
  });

  it("marks sections without an instructor", () => {
    const s = fresh();
    const s2 = withProgram(s, { instructors: s.program.instructors.map((p) => (p.rank === "adjunct" ? { ...p, headcount: 10 } : p)) });
    const a = analysisOf(s2);
    expect(a.unstaffedSections).toBeGreaterThan(0);
    expect(foundersWindows(a).kinds.filter((k) => k === "gap")).toHaveLength(a.unstaffedSections);
  });

  it("lets each window stand for more sections when the schedule outgrows the facade", () => {
    const room = FOUNDERS_WINDOWS.cols * FOUNDERS_WINDOWS.rows;
    const s = withProgram(fresh(), { policies: { ...MIDLAND_STATE.policies, caps: { ENGL101: 12, ENGL101S: 9, ENGL102: 12 } } });
    const a = analysisOf(s);
    expect(a.totalSections).toBeGreaterThan(room);
    const w = foundersWindows(a);
    expect(w.perWindow).toBe(2);
    expect(w.kinds.length).toBeLessThanOrEqual(room);
  });
});

describe("campus life", () => {
  it("sends students without a seat to wait outside, and fewer walkers out at night", () => {
    const s = withProgram(fresh(), { cancellations: [{ courseId: "ENGL101", term: "fall", sections: 2 }] });
    const a = analysisOf(s);
    const day = campusLife(s, a, 0);
    expect(day.stranded).toBeGreaterThan(0);
    expect(campusLife(s, a, 1).walkers).toBeLessThan(day.walkers);
    expect(campusLife(fresh(), analysisOf(fresh()), 0).stranded).toBe(0);
  });

  it("shows someone leaving when a pool that quits drops below the morale line", () => {
    const s = fresh();
    expect(campusLife(s, analysisOf(s), 0).leaving).toBeNull();
    const low = withProgram(s, {
      instructors: s.program.instructors.map((p) => (p.rank === "adjunct" ? { ...p, morale: MORALE_ATTRITION.threshold - 1 } : p)),
    });
    expect(campusLife(low, analysisOf(low), 0).leaving).toBe("adjunct");
  });
});
