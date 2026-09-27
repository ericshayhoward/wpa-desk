import { describe, expect, it } from "vitest";
import { MIDLAND_STATE } from "../../model";
import { CAST, STANDARD_ARC, scenarioById } from "../../content";
import { advanceTerm, blockingScenarios, resolveScenario, startSession, type TrainingSession } from "../index";
import { closeOutTerm } from "../../test-fixtures/reports";

const appeal = scenarioById("grade-appeal")!;
const only = [appeal];

const trust = (s: TrainingSession, id: string) => s.program.stakeholders.find((x) => x.id === id)!.trust;
const next = (s: TrainingSession) => advanceTerm(closeOutTerm(s), only, STANDARD_ARC).session;
const spring = () => next(startSession(MIDLAND_STATE, only, STANDARD_ARC));
const decide = (s: TrainingSession, id: string) => resolveScenario(s, appeal, id, null, CAST);

describe("The Grade Appeal Escalation", () => {
  it("arrives in Spring, Year 1 and can't wait", () => {
    expect(startSession(MIDLAND_STATE, only, STANDARD_ARC).inbox).not.toContain("grade-appeal");
    const s = spring();
    expect(s.inbox).toContain("grade-appeal");
    expect(blockingScenarios(s, only).map((x) => x.id)).toEqual(["grade-appeal"]);
    expect(() => advanceTerm(closeOutTerm(s), only, STANDARD_ARC)).toThrow(/Resolve before Spring, Year 1 ends: The Grade Appeal Escalation/);
  });

  it("following the process earns trust all around, and GTAs come to you in the fall", () => {
    const r = decide(spring(), "follow-process");
    expect(r.outcome.reply!.body).toMatch(/We followed our policy, found an error, and fixed it/);
    let s = r.session;
    expect([trust(s, "provost_office"), trust(s, "students"), trust(s, "gta_cohort"), trust(s, "fyw_director")]).toEqual([53, 58, 53, 63]);
    expect(s.adminHoursRemaining).toBe(54);
    s = next(s);
    expect(trust(s, "gta_cohort")).toBe(55);
  });

  it("changing the grade pleases the provost's office now and costs later", () => {
    let s = decide(spring(), "change-grade").session;
    expect([trust(s, "provost_office"), trust(s, "gta_cohort"), trust(s, "fyw_director")]).toEqual([54, 42, 55]);
    expect(s.program.instructors.find((p) => p.rank === "gta")!.morale).toBeLessThan(
      MIDLAND_STATE.instructors.find((p) => p.rank === "gta")!.morale,
    );
    s = next(s);
    expect(trust(s, "provost_office")).toBe(50);
  });

  it("calling the parent runs into FERPA", () => {
    const r = decide(spring(), "call-parent");
    expect(r.outcome.consequence.narrative).toMatch(/the record belongs to the student, not the parent/);
    expect([trust(r.session, "provost_office"), trust(r.session, "fyw_director")]).toEqual([45, 57]);
  });

  it("backing the instructor wins GTAs, then the appeals committee overturns the grade", () => {
    let s = decide(spring(), "back-instructor").session;
    expect([trust(s, "gta_cohort"), trust(s, "provost_office")]).toEqual([55, 48]);
    s = next(s);
    expect([trust(s, "provost_office"), trust(s, "students"), trust(s, "fyw_director")]).toEqual([43, 52, 58]);
  });
});
