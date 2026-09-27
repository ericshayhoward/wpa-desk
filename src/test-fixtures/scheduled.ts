/** Helpers for decisions whose program changes are announced for a later term. */
import { applyChanges, type Program } from "../model";
import type { TrainingSession } from "../training";

/** The program once every announced change still pending has landed. */
export function landed(s: TrainingSession): Program {
  return applyChanges(s.program, s.pending.filter((p) => p.announced).flatMap((p) => p.changes));
}
