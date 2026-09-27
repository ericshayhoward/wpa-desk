import { DEFAULT_ASSUMPTIONS, analyzeTerm } from "../model";
import { termOf } from "./terms";
import type { Arc, DissertationStatus, TermRecord, TrainingSession } from "./types";

/**
 * The program's numbers as the current term stands. Recorded when a term
 * ends, so reports and endings can look back across years.
 */
export function recordTerm(
  session: Pick<TrainingSession, "program" | "termIndex" | "adminHoursRemaining" | "overtimeHours">,
): TermRecord {
  const term = termOf(session.termIndex);
  const a = analyzeTerm(session.program, term, DEFAULT_ASSUMPTIONS);
  return {
    termIndex: session.termIndex,
    term,
    totalSections: a.totalSections,
    unstaffedSections: a.unstaffedSections,
    seatsUnserved: a.totalSeatsUnserved,
    dfw: a.dfw,
    budgetBalance: a.budgetBalance,
    instructors: session.program.instructors.map((p) => ({ rank: p.rank, headcount: p.headcount, morale: p.morale })),
    trust: session.program.stakeholders.map((s) => ({ stakeholder: s.id, trust: s.trust })),
    adminHoursUnspent: session.adminHoursRemaining - session.overtimeHours,
  };
}

/**
 * Dissertation progress from admin hours left unspent in completed terms.
 * Pass `final` to count the current term too (at the end of the arc).
 */
export function dissertationStatus(session: TrainingSession, arc: Arc, final?: TermRecord): DissertationStatus | null {
  const spec = arc.dissertation;
  if (!spec) return null;
  const records = final ? [...session.history, final] : session.history;
  const hours = Math.max(0, records.reduce((n, r) => n + r.adminHoursUnspent, 0));
  const progress = Math.min(1, hours / spec.hoursToFinish);
  return {
    hours,
    hoursToFinish: spec.hoursToFinish,
    progress,
    status: progress >= 1 ? "finished" : progress >= spec.onTrackAt ? "on_track" : "behind",
  };
}

export const DISSERTATION_LABELS: Record<DissertationStatus["status"], string> = {
  finished: "Finished",
  on_track: "On track to defend by summer",
  behind: "Behind",
};
