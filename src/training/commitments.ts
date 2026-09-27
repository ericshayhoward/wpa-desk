import { applyChanges } from "../model";
import type { Commitment, TrainingSession } from "./types";

/**
 * How commitments move trust with the memo's reader. Missing a promise costs
 * more than keeping one earns: people remember broken commitments longer.
 */
export const COMMITMENT_EFFECTS = {
  keptTrust: 3,
  missedTrust: -6,
  extensionTrust: -1,
} as const;

export const EFFORT_CHOICES = [2, 4, 8, 12] as const;

/** Open commitments due this term or earlier. */
export function commitmentsDue(session: TrainingSession): Commitment[] {
  return session.commitments.filter((c) => c.status === "open" && c.dueTerm <= session.termIndex);
}

/** Why a commitment can't be delivered right now, or null if it can. */
export function cannotDeliver(session: TrainingSession, c: Commitment): string | null {
  if (c.status !== "open") return "Already resolved.";
  if (c.effortHours > session.adminHoursRemaining) {
    return `Needs ${c.effortHours} admin hours; you have ${session.adminHoursRemaining} left this term.`;
  }
  return null;
}

/** Spends the effort and marks the commitment kept. Delivering early is allowed. */
export function deliverCommitment(session: TrainingSession, id: string): TrainingSession {
  const c = find(session, id);
  const blocked = cannotDeliver(session, c);
  if (blocked) throw new Error(blocked);
  return settle(
    { ...session, adminHoursRemaining: session.adminHoursRemaining - c.effortHours },
    c,
    { status: "kept" },
    COMMITMENT_EFFECTS.keptTrust,
  );
}

/** Pushes a due commitment back one term, once, at a small trust cost. */
export function extendCommitment(session: TrainingSession, id: string): TrainingSession {
  const c = find(session, id);
  if (c.status !== "open") throw new Error("Already resolved.");
  if (c.extended) throw new Error("You've already asked for an extension on this one.");
  if (c.dueTerm > session.termIndex) throw new Error("It isn't due yet.");
  return settle(session, c, { dueTerm: c.dueTerm + 1, extended: true }, COMMITMENT_EFFECTS.extensionTrust);
}

/** Tells the reader it won't happen. Same cost as missing it, but on your terms. */
export function abandonCommitment(session: TrainingSession, id: string): TrainingSession {
  const c = find(session, id);
  if (c.status !== "open") throw new Error("Already resolved.");
  return settle(session, c, { status: "missed" }, COMMITMENT_EFFECTS.missedTrust);
}

/** At term end: anything due and still open is missed. */
export function missOverdue(session: TrainingSession): { session: TrainingSession; missed: Commitment[] } {
  const overdue = commitmentsDue(session);
  let s = session;
  for (const c of overdue) s = settle(s, c, { status: "missed" }, COMMITMENT_EFFECTS.missedTrust);
  return { session: s, missed: overdue.map((c) => s.commitments.find((x) => x.id === c.id)!) };
}

// ---------------------------------------------------------------------------

function find(session: TrainingSession, id: string): Commitment {
  const c = session.commitments.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown commitment ${id}`);
  return c;
}

function settle(session: TrainingSession, c: Commitment, patch: Partial<Commitment>, trustDelta: number): TrainingSession {
  const resolved = patch.status && patch.status !== "open";
  return {
    ...session,
    program: applyChanges(session.program, [{ kind: "adjustTrust", stakeholder: c.audience, delta: trustDelta }]),
    commitments: session.commitments.map((x) =>
      x.id === c.id ? { ...x, ...patch, resolvedTerm: resolved ? session.termIndex : x.resolvedTerm } : x,
    ),
  };
}
