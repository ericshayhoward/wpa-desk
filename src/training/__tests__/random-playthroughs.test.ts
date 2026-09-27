/**
 * Whole-arc playthroughs with seeded random choices: every scenario in the
 * standard arc, random options, memos, evidence, commitments, and staffing
 * decisions. Catches interactions no single scenario test covers: text left
 * with an unfilled {{placeholder}}, a crash in a late term, a save that
 * doesn't round-trip, or an arc that can't reach its ending.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges } from "../../model";
import { ARCS, CAST, SCENARIOS, STANDARD_ARC } from "../../content";
import {
  addEvidence,
  advanceTerm,
  capAnalysisEvidence,
  commitmentsDue,
  createSave,
  deliverCommitment,
  fillTemplate,
  parseSave,
  reportDue,
  resolveScenario,
  resolveStaffing,
  staffingDue,
  staffingPlanEvidence,
  startSession,
  submitReport,
  termOf,
  unavailableReason,
  type MemoDraft,
  type TrainingSession,
} from "../index";

const SEEDS = 10;

function random(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

const unfilled = /\{\{/;

function play(seed: number): TrainingSession {
  const r = random(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  let s = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);

  const check = (where: string) => {
    for (const st of s.program.stakeholders) expect(st.trust, where).toBeGreaterThanOrEqual(0);
    expect(s.adminHoursRemaining, where).toBeGreaterThanOrEqual(0);
    expect(s.adminHoursRemaining, where).toBeLessThanOrEqual(s.adminHoursPerTerm);
    expect(parseSave(JSON.parse(JSON.stringify(createSave(s, "x", new Date()))), SCENARIOS, ARCS).session, where).toEqual(s);
  };
  const cover = () => {
    for (let n = 0; n < 5 && staffingDue(s, STANDARD_ARC, SCENARIOS); n++) {
      s = resolveStaffing(s, STANDARD_ARC, SCENARIOS, n === 0 ? pick(["hire", "teach", "cancel"] as const) : "hire").session;
    }
  };

  while (!s.ending) {
    const term = termOf(s.termIndex);
    const now = analyzeTerm(s.program, term, A);
    if (r() < 0.6) {
      const at27 = applyChanges(s.program, [{ kind: "setCap", courseId: "ENGL101", cap: 27 }]);
      s = addEvidence(s, capAnalysisEvidence(s.program, { ...s.program.policies.caps, ENGL101: 27 }, now, analyzeTerm(at27, term, A)));
    }
    if (r() < 0.6) s = addEvidence(s, staffingPlanEvidence(s.program, [], now, now));

    for (const id of [...s.inbox]) {
      const scenario = SCENARIOS.find((x) => x.id === id)!;
      for (const d of scenario.documents) expect(fillTemplate(d.subject + d.body, s), id).not.toMatch(unfilled);
      if (!scenario.urgent && r() < 0.15) continue; // leave some waiting
      const option = pick(scenario.options.filter((o) => !unavailableReason(s, o)));
      const memo: MemoDraft | null =
        option.memo && (option.memo.required || r() < 0.5)
          ? {
              audience: option.memo.audience,
              subject: "S",
              ask: "A",
              body: "B",
              evidenceIds: s.evidence.filter(() => r() < 0.5).map((e) => e.id),
              commitments: r() < 0.5 ? [{ text: "Do it", dueInTerms: 1 + Math.floor(r() * 4), effortHours: pick([2, 4, 8, 12]) }] : [],
              selfAssessment: {},
            }
          : null;
      const { session, outcome } = resolveScenario(s, scenario, option.id, memo, CAST);
      s = session;
      const where = `${id}/${option.id}`;
      expect(outcome.consequence.narrative, where).not.toMatch(unfilled);
      expect(outcome.reply?.body ?? "", where).not.toMatch(unfilled);
      for (const q of outcome.queued) expect(q.note, where).not.toMatch(unfilled);
      check(where);
    }

    for (const c of commitmentsDue(s)) {
      if (r() < 0.6 && c.effortHours <= s.adminHoursRemaining) s = deliverCommitment(s, c.id);
    }
    cover();
    const spec = reportDue(s, STANDARD_ARC);
    if (spec) {
      const sections = Object.fromEntries(spec.playerSections.map((id) => [id, { body: "Words here.", history: [] }]));
      s = { ...s, reportDraft: { termIndex: spec.term, startedAt: new Date().toISOString(), sections } };
      s = submitReport(s, STANDARD_ARC, SCENARIOS, new Date()).session;
      check(`report, term ${spec.term}`);
    }
    if (!s.ending) {
      s = advanceTerm(s, SCENARIOS, STANDARD_ARC).session;
      check(`start of term ${s.termIndex}`);
    }
  }
  return s;
}

describe("random playthroughs of the standard arc", () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`reach an ending with every text filled and every save loadable (seed ${seed})`, () => {
      const s = play(seed);
      expect(s.termIndex).toBe(STANDARD_ARC.terms);
      expect(s.ending!.score).toBeGreaterThanOrEqual(0);
      expect(s.ending!.score).toBeLessThanOrEqual(100);
    });
  }
});
