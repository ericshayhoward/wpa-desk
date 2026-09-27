/**
 * How an arc ends: a score from three years of results, turned into one of
 * the arc's outcomes. The annual report is shown alongside it but never
 * scored. Every factor explains itself, so the ending reads as a debrief
 * rather than a grade.
 */
import type { StakeholderId } from "../model";
import { dissertationStatus, DISSERTATION_LABELS } from "./history";
import type { Arc, EndingFactor, EndingId, EndingResult, TermRecord, TrainingSession } from "./types";

/**
 * Factor weights and scales. Illustrative: they set how much each part of a
 * WPA's record matters on the market, and will need calibrating as more
 * scenarios make the arc fuller. Weights sum to 100.
 */
export const ENDING_RULES = {
  program: { max: 20, start: 10, perDfwPoint: 2, dfwCap: 6, coveredBonus: 2, perUnstaffedTerm: 2, unstaffedCap: 6, budget: 2 },
  recommender: { max: 15, trustAtZero: 40, trustAtMax: 90 },
  relationships: { max: 15, trustAtZero: 30, trustAtMax: 80 },
  instructors: { max: 15, atZero: 30, atMax: 80, groups: ["adjunct_faculty", "gta_cohort"] as StakeholderId[] },
  commitments: { max: 15 },
  dissertation: { max: 20 },
} as const;

/** Scores a session whose history includes its final term. */
export function computeEnding(session: TrainingSession, arc: Arc): EndingResult {
  const spec = arc.endings;
  if (!spec) throw new Error(`${arc.title} has no endings.`);
  const final = session.history[session.history.length - 1];
  if (!final) throw new Error("No term history to score.");
  const base = session.baseline;
  const diss = dissertationStatus(session, arc) ?? { hours: 0, hoursToFinish: 1, progress: 1, status: "finished" as const };

  const factors = [
    programFactor(base, final, session.history),
    trustFactor(
      "recommender",
      "Recommendation letter",
      [spec.recommender],
      final,
      ENDING_RULES.recommender,
      (t) => `Trust with your supervisor ended at ${t}. Your supervisor's letter is the one search committees read most closely.`,
    ),
    trustFactor(
      "relationships",
      "Campus relationships",
      spec.relationships,
      final,
      ENDING_RULES.relationships,
      (t) => `Average trust with the people you worked with across campus ended at ${t}.`,
    ),
    instructorsFactor(final),
    commitmentsFactor(session),
    {
      id: "dissertation",
      label: "Dissertation",
      points: round(diss.progress * ENDING_RULES.dissertation.max),
      max: ENDING_RULES.dissertation.max,
      explanation: `${Math.round(diss.progress * 100)}% complete (${diss.hours} of ${diss.hoursToFinish} hours): ${DISSERTATION_LABELS[diss.status].toLowerCase()}. Every admin hour you didn't spend went here.`,
    },
  ];
  const score = round(factors.reduce((n, f) => n + f.points, 0));

  let id: EndingId = score >= spec.tenureTrackAt ? "tenure_track" : score >= spec.twoYearAt ? "two_year" : "rotated_out";
  let gateNote: string | null = null;
  if (id === "tenure_track" && diss.status === "behind") {
    id = "two_year";
    gateNote =
      "Your record was strong enough for a university tenure-track job, but those searches need the dissertation finished or on track to defend by summer, and yours was behind.";
  }
  const outcome = spec.outcomes[id];
  return {
    id,
    title: outcome.title,
    narrative: outcome.narrative,
    score,
    factors,
    dissertation: diss,
    gateNote,
    thresholds: { tenureTrackAt: spec.tenureTrackAt, twoYearAt: spec.twoYearAt },
    termIndex: session.termIndex,
  };
}

function programFactor(base: TermRecord, final: TermRecord, history: TermRecord[]): EndingFactor {
  const r = ENDING_RULES.program;
  // Fall and spring enroll different courses, so D/F/W compares like terms:
  // the latest term of the same kind as the baseline.
  const like = [...history].reverse().find((h) => h.term === base.term) ?? final;
  const dfwChange = (like.dfw.mid - base.dfw.mid) * 100; // percentage points
  const dfwPoints = clamp(-dfwChange * r.perDfwPoint, -r.dfwCap, r.dfwCap);
  // Terms where students went without a seat: sections left uncovered or cancelled.
  const shortTerms = history.filter((h) => h.unstaffedSections > 0 || h.seatsUnserved > 0).length;
  const coverage = shortTerms === 0 ? r.coveredBonus : -Math.min(r.unstaffedCap, shortTerms * r.perUnstaffedTerm);
  // Fall and spring budgets differ a lot, so judge the final year as a whole.
  const finalYear = history.slice(-2).reduce((n, h) => n + h.budgetBalance, 0);
  const budget = finalYear >= 0 ? r.budget : -r.budget;
  const points = round(clamp(r.start + dfwPoints + coverage + budget, 0, r.max));
  const dfwText =
    Math.abs(dfwChange) < 0.05
      ? `Projected ${base.term} D/F/W is where it was when you started`
      : `Projected ${base.term} D/F/W is ${Math.abs(dfwChange).toFixed(1)} points ${dfwChange > 0 ? "higher" : "lower"} than when you started`;
  const coverText =
    shortTerms === 0
      ? "every student who needed a section had one"
      : `${shortTerms} term${shortTerms > 1 ? "s" : ""} ended with students unable to get a section`;
  const budgetText =
    finalYear >= 0 ? "the instruction budget balanced over the final year" : "the instruction line ran a deficit over the final year";
  return {
    id: "program",
    label: "Program outcomes",
    points,
    max: r.max,
    explanation: `${dfwText}; ${coverText}; ${budgetText}.`,
  };
}

function trustFactor(
  id: string,
  label: string,
  who: readonly StakeholderId[],
  final: TermRecord,
  scale: { max: number; trustAtZero: number; trustAtMax: number },
  explain: (avg: number) => string,
): EndingFactor {
  const avg = Math.round(average(who.map((s) => final.trust.find((t) => t.stakeholder === s)?.trust ?? 0)));
  return { id, label, points: scaled(avg, scale.trustAtZero, scale.trustAtMax, scale.max), max: scale.max, explanation: explain(avg) };
}

function instructorsFactor(final: TermRecord): EndingFactor {
  const r = ENDING_RULES.instructors;
  const trust = r.groups.map((g) => final.trust.find((t) => t.stakeholder === g)?.trust ?? 0);
  const morale = final.instructors.filter((p) => p.rank !== "tt" && p.headcount > 0).map((p) => p.morale);
  const avg = Math.round(average([...trust, ...morale]));
  return {
    id: "instructors",
    label: "Instructors",
    points: scaled(avg, r.atZero, r.atMax, r.max),
    max: r.max,
    explanation: `Contingent and graduate instructors' trust and morale averaged ${avg}. Candidates are asked how they supported the people who teach.`,
  };
}

function commitmentsFactor(session: TrainingSession): EndingFactor {
  const max = ENDING_RULES.commitments.max;
  const kept = session.commitments.filter((c) => c.status === "kept").length;
  const missed = session.commitments.filter((c) => c.status === "missed").length;
  if (kept + missed === 0) {
    return {
      id: "commitments",
      label: "Commitments",
      points: max / 2,
      max,
      explanation: "No commitments came due, so there's no record either way of following through.",
    };
  }
  return {
    id: "commitments",
    label: "Commitments",
    points: round((kept / (kept + missed)) * max),
    max,
    explanation: `You kept ${kept} of the ${kept + missed} commitments that came due.`,
  };
}

function scaled(value: number, atZero: number, atMax: number, max: number): number {
  return round(clamp(((value - atZero) / (atMax - atZero)) * max, 0, max));
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
function average(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function round(x: number): number {
  return Math.round(x * 10) / 10;
}
