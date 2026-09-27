/** Helpers for playing through the end of a term in tests. */
import { SCENARIOS, STANDARD_ARC } from "../content";
import { reportDue, resolveStaffing, staffingDue, submitReport, type TrainingSession } from "../training";

/**
 * Gets a standard-arc term ready to end: hires adjuncts for any uncovered
 * sections, then writes every player section of a due report and submits it.
 */
export function closeOutTerm(s: TrainingSession, body = "Our numbers held steady."): TrainingSession {
  if (staffingDue(s, STANDARD_ARC, SCENARIOS)) s = resolveStaffing(s, STANDARD_ARC, SCENARIOS, "hire").session;
  const spec = reportDue(s, STANDARD_ARC);
  if (!spec) return s;
  const sections = Object.fromEntries(spec.playerSections.map((id) => [id, { body, history: [] }]));
  const drafted = { ...s, reportDraft: { termIndex: spec.term, startedAt: new Date().toISOString(), sections } };
  return submitReport(drafted, STANDARD_ARC, SCENARIOS, new Date()).session;
}
