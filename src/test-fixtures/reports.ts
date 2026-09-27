/** Helpers for playing through year-end reports in tests. */
import { SCENARIOS, STANDARD_ARC } from "../content";
import { reportDue, submitReport, type TrainingSession } from "../training";

/** Writes every player section of the report due this term, if any, and submits it. */
export function submitDueReport(s: TrainingSession, body = "Our numbers held steady."): TrainingSession {
  const spec = reportDue(s, STANDARD_ARC);
  if (!spec) return s;
  const sections = Object.fromEntries(spec.playerSections.map((id) => [id, { body, history: [] }]));
  const drafted = { ...s, reportDraft: { termIndex: spec.term, startedAt: new Date().toISOString(), sections } };
  return submitReport(drafted, STANDARD_ARC, SCENARIOS, new Date()).session;
}
