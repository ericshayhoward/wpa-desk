import {
  DEFAULT_ASSUMPTIONS,
  analyzeTerm,
  applyChanges,
  compareTerms,
  type Program,
  type ProgramChange,
} from "../model";
import type { EvidenceDraft } from "./evidence";
import { isEligible } from "./scenario";
import type {
  CareerStage,
  Commitment,
  Consequence,
  DecisionOutcome,
  Memo,
  MemoDraft,
  PendingEffect,
  Scenario,
  ScenarioOption,
  TrainingSession,
} from "./types";

export const DEFAULT_ADMIN_HOURS_PER_TERM = 60;

export function startSession(program: Program, scenarios: Scenario[], stage: CareerStage = "wpa"): TrainingSession {
  const session: TrainingSession = {
    program,
    termIndex: 1,
    stage,
    adminHoursPerTerm: DEFAULT_ADMIN_HOURS_PER_TERM,
    adminHoursRemaining: DEFAULT_ADMIN_HOURS_PER_TERM,
    inbox: [],
    decisions: [],
    pending: [],
    evidence: [],
    dossier: [],
    commitments: [],
    nextId: 1,
  };
  return { ...session, inbox: eligibleInbox(session, scenarios) };
}

export function addEvidence(session: TrainingSession, draft: EvidenceDraft): TrainingSession {
  const evidence = { ...draft, id: `ev-${session.nextId}`, termIndex: session.termIndex };
  return { ...session, evidence: [...session.evidence, evidence], nextId: session.nextId + 1 };
}

/** Why an option can't be chosen right now, or null if it can. */
export function unavailableReason(session: TrainingSession, option: ScenarioOption): string | null {
  if (option.cost.adminHours > session.adminHoursRemaining) {
    return `Needs ${option.cost.adminHours} admin hours; you have ${session.adminHoursRemaining} left this term.`;
  }
  if (option.cost.politicalCapital > session.program.politicalCapital) {
    return `Needs ${option.cost.politicalCapital} political capital; you have ${session.program.politicalCapital}.`;
  }
  return null;
}

/**
 * Resolves a scenario: files the memo (if any), decides persuasion from the
 * attached evidence, applies consequences and costs, and queues delayed effects.
 */
export function resolveScenario(
  session: TrainingSession,
  scenario: Scenario,
  optionId: string,
  memoDraft: MemoDraft | null,
): { session: TrainingSession; outcome: DecisionOutcome } {
  if (!session.inbox.includes(scenario.id)) throw new Error(`Scenario ${scenario.id} is not in the inbox`);
  const option = scenario.options.find((o) => o.id === optionId);
  if (!option) throw new Error(`Unknown option ${optionId} for ${scenario.id}`);
  const blocked = unavailableReason(session, option);
  if (blocked) throw new Error(blocked);
  if (option.memo?.required && !memoDraft) throw new Error(`Option "${option.label}" requires a memo`);

  let nextId = session.nextId;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;

  // ---- File the memo and its commitments ----
  let memo: Memo | null = null;
  const commitments: Commitment[] = [];
  if (memoDraft) {
    const memoId = newId("memo");
    for (const c of memoDraft.commitments) {
      if (!c.text.trim()) continue;
      commitments.push({
        id: newId("commit"),
        text: c.text.trim(),
        dueTerm: session.termIndex + Math.max(1, Math.round(c.dueInTerms)),
        status: "open",
        memoId,
      });
    }
    const { commitments: _drop, ...rest } = memoDraft;
    memo = {
      ...rest,
      id: memoId,
      scenarioId: scenario.id,
      optionId,
      termIndex: session.termIndex,
      commitmentIds: commitments.map((c) => c.id),
    };
  }

  // ---- Decide the consequence ----
  let consequence: Consequence;
  let persuaded: boolean | null = null;
  let missingEvidence: DecisionOutcome["missingEvidence"] = [];
  if (option.persuasion) {
    const attachedKinds = new Set(
      session.evidence.filter((e) => memoDraft?.evidenceIds.includes(e.id)).map((e) => e.kind),
    );
    missingEvidence = option.persuasion.evidenceKinds.filter((k) => !attachedKinds.has(k));
    persuaded = missingEvidence.length === 0;
    consequence = persuaded ? option.persuasion.persuaded : option.persuasion.unpersuaded;
  } else {
    consequence = option.consequence!;
  }

  // ---- Apply ----
  const costChanges: ProgramChange[] =
    option.cost.politicalCapital > 0 ? [{ kind: "adjustPoliticalCapital", delta: -option.cost.politicalCapital }] : [];
  const before = session.program;
  const after = applyChanges(before, [...consequence.changes, ...costChanges]);

  const queued: PendingEffect[] = consequence.delayed.map((d) => ({
    ...d,
    dueTerm: session.termIndex + d.inTerms,
    scenarioId: scenario.id,
  }));

  const trustChanges = after.stakeholders
    .map((s) => ({ stakeholder: s.id, before: before.stakeholders.find((b) => b.id === s.id)?.trust ?? s.trust, after: s.trust }))
    .filter((t) => t.before !== t.after);

  const impactTerm = "fall" as const;
  const impact = {
    term: impactTerm,
    comparison: compareTerms(
      analyzeTerm(before, impactTerm, DEFAULT_ASSUMPTIONS),
      analyzeTerm(after, impactTerm, DEFAULT_ASSUMPTIONS),
    ),
  };

  const nextSession: TrainingSession = {
    ...session,
    program: after,
    adminHoursRemaining: session.adminHoursRemaining - option.cost.adminHours,
    inbox: session.inbox.filter((id) => id !== scenario.id),
    decisions: [
      ...session.decisions,
      { scenarioId: scenario.id, optionId, termIndex: session.termIndex, memoId: memo?.id ?? null, persuaded },
    ],
    pending: [...session.pending, ...queued],
    dossier: memo ? [...session.dossier, memo] : session.dossier,
    commitments: [...session.commitments, ...commitments],
    nextId,
  };

  return {
    session: nextSession,
    outcome: {
      scenario,
      option,
      consequence,
      persuaded,
      missingEvidence,
      trustChanges,
      politicalCapital: { before: before.politicalCapital, after: after.politicalCapital },
      impact,
      queued,
      memo,
    },
  };
}

/** Moves to the next term, applying delayed effects that come due. */
export function advanceTerm(
  session: TrainingSession,
  scenarios: Scenario[],
): { session: TrainingSession; applied: PendingEffect[] } {
  const termIndex = session.termIndex + 1;
  const applied = session.pending.filter((p) => p.dueTerm <= termIndex);
  const program = applyChanges(session.program, applied.flatMap((p) => p.changes));
  const advanced: TrainingSession = {
    ...session,
    program,
    termIndex,
    adminHoursRemaining: session.adminHoursPerTerm,
    pending: session.pending.filter((p) => p.dueTerm > termIndex),
  };
  return { session: { ...advanced, inbox: eligibleInbox(advanced, scenarios) }, applied };
}

function eligibleInbox(session: TrainingSession, scenarios: Scenario[]): string[] {
  const done = new Set(session.decisions.map((d) => d.scenarioId));
  const carried = session.inbox.filter((id) => !done.has(id));
  const fresh = scenarios.filter((s) => !done.has(s.id) && !carried.includes(s.id) && isEligible(s, session)).map((s) => s.id);
  return [...carried, ...fresh];
}
