import {
  DEFAULT_ASSUMPTIONS,
  analyzeTerm,
  applyChanges,
  compareTerms,
  describeChange,
  type Program,
  type ProgramChange,
  type Term,
} from "../model";
import { arcAllows, checkArc, isFinalTerm, stageChangeAt, timeCostAt } from "./arc";
import { recordTerm } from "./history";
import { reportDue } from "./report";
import { staffingDue } from "./staffing";
import type { EvidenceDraft } from "./evidence";
import { persuasionProfile } from "./cast";
import { missOverdue } from "./commitments";
import { applyMoraleAttrition } from "./morale";
import { fillTemplate } from "./template";
import { isEligible } from "./scenario";
import { termLabel, termOf } from "./terms";
import type {
  Arc,
  Character,
  Commitment,
  ComputedChange,
  Consequence,
  DecisionOutcome,
  Memo,
  MemoDraft,
  PendingEffect,
  Reply,
  Scenario,
  ScenarioChange,
  ScenarioOption,
  TrainingSession,
} from "./types";
import { DEFAULT_SETTINGS, REPLY_TONE, type SessionSettings } from "./types";

export const DEFAULT_ADMIN_HOURS_PER_TERM = 60;

/** Political capital earned back when a memo persuades its reader: winning a case builds standing. */
export const PERSUASION_CAPITAL = 2;

/**
 * Starts a session. With an arc, scenarios arrive on its calendar and the
 * player's role follows it; without one (free play), any scenario whose
 * trigger holds can arrive.
 */
export function startSession(
  program: Program,
  scenarios: Scenario[],
  arc?: Arc,
  settings: SessionSettings = DEFAULT_SETTINGS,
): TrainingSession {
  const session: TrainingSession = {
    program,
    settings,
    termIndex: 1,
    stage: arc?.startStage ?? "wpa",
    ...(arc && { arcId: arc.id }),
    adminHoursPerTerm: DEFAULT_ADMIN_HOURS_PER_TERM,
    adminHoursRemaining: DEFAULT_ADMIN_HOURS_PER_TERM - (timeCostAt(arc, 1)?.hours ?? 0),
    inbox: [],
    decisions: [],
    pending: [],
    evidence: [],
    dossier: [],
    commitments: [],
    nextId: 1,
    history: [],
    overtimeHours: 0,
    reports: [],
    staffingLog: [],
    baseline: { ...recordTerm({ program, termIndex: 1, adminHoursRemaining: 0, overtimeHours: 0 }) },
  };
  return deliver(session, scenarios, arc);
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
  if (option.requires) {
    const who = session.program.stakeholders.find((x) => x.id === option.requires!.stakeholder);
    const trust = who?.trust ?? 0;
    if (trust < option.requires.minTrust) {
      return `Needs trust of ${option.requires.minTrust} with the ${who?.name ?? option.requires.stakeholder} (now ${trust}).`;
    }
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
  cast: Character[] = [],
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
        audience: memoDraft.audience,
        effortHours: Math.max(1, Math.round(c.effortHours)),
        extended: false,
        resolvedTerm: null,
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
  let persuasion: DecisionOutcome["persuasion"] = null;
  if (option.persuasion) {
    // Persuasion depends on the relationship as well as the evidence: the
    // reader's trust must clear their bar, which is much higher without the
    // evidence they need.
    const attachedKinds = new Set(
      session.evidence.filter((e) => memoDraft?.evidenceIds.includes(e.id)).map((e) => e.kind),
    );
    missingEvidence = option.persuasion.evidenceKinds.filter((k) => !attachedKinds.has(k));
    const reader = option.memo!.audience;
    const trust = trustOf(session, reader);
    const profile = persuasionProfile(cast, reader);
    const hadEvidence = missingEvidence.length === 0;
    const needed = hadEvidence ? profile.withEvidence : profile.withoutEvidence;
    persuaded = trust >= needed;
    persuasion = { reader, trust, needed, hadEvidence };
    consequence = persuaded ? option.persuasion.persuaded : option.persuasion.unpersuaded;
  } else {
    consequence = option.consequence!;
  }
  // Prose can state the program's numbers through placeholders, filled as
  // things stand at the moment of decision.
  const fill = (text: string) => fillTemplate(text, session);
  consequence = {
    ...consequence,
    narrative: fill(consequence.narrative),
    delayed: consequence.delayed.map((d) => ({ ...d, note: fill(d.note) })),
  };

  // The reply's tone reflects the relationship going in.
  const chosen = consequence.response ? chooseReply(consequence.response, trustOf(session, consequence.response.from)) : null;
  const reply = chosen && { ...chosen, body: fill(chosen.body) };

  // ---- Apply ----
  const before = session.program;
  const term = termOf(session.termIndex);
  const resolved = resolveChanges(before, term, consequence.changes);
  const capital = (persuaded ? PERSUASION_CAPITAL : 0) - option.cost.politicalCapital;
  const costChanges: ProgramChange[] = capital !== 0 ? [{ kind: "adjustPoliticalCapital", delta: capital }] : [];
  const after = applyChanges(before, [...resolved, ...costChanges]);

  // Delayed changes are worked out now, against the program as the player
  // found it, so a later revert undoes exactly what was given.
  const queued: PendingEffect[] = consequence.delayed.map((d) => ({
    ...d,
    changes: d.changes.map((c) => (c.kind === "computed" ? resolveAmounts(before, term, c) : c)).filter((c) => !isNoop(c)),
    dueTerm: session.termIndex + d.inTerms,
    scenarioId: scenario.id,
  }));

  const trustChanges = after.stakeholders
    .map((s) => ({ stakeholder: s.id, before: before.stakeholders.find((b) => b.id === s.id)?.trust ?? s.trust, after: s.trust }))
    .filter((t) => t.before !== t.after);

  const impact = {
    term,
    comparison: compareTerms(analyzeTerm(before, term, DEFAULT_ASSUMPTIONS), analyzeTerm(after, term, DEFAULT_ASSUMPTIONS)),
  };
  const changeDescriptions = resolved
    .filter((c) => c.kind !== "adjustTrust" && c.kind !== "adjustPoliticalCapital")
    .map((c) => describeChange(before, c));

  const { [scenario.id]: _sentDraft, ...remainingDrafts } = session.drafts ?? {};
  const nextSession: TrainingSession = {
    ...session,
    drafts: remainingDrafts,
    program: after,
    adminHoursRemaining: session.adminHoursRemaining - option.cost.adminHours,
    inbox: session.inbox.filter((id) => id !== scenario.id),
    decisions: [
      ...session.decisions,
      {
        scenarioId: scenario.id,
        optionId,
        termIndex: session.termIndex,
        memoId: memo?.id ?? null,
        persuaded,
        snapshot: {
          documents: scenario.documents.map((d) => ({
            ...d,
            subject: fillTemplate(d.subject, session),
            body: fillTemplate(d.body, session),
          })),
          narrative: consequence.narrative,
          reply,
          persuasion,
          missingEvidence,
          trustChanges,
          changeDescriptions,
        },
      },
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
      persuasion,
      reply,
      trustChanges,
      politicalCapital: { before: before.politicalCapital, after: after.politicalCapital },
      impact,
      changeDescriptions,
      queued,
      memo,
    },
  };
}

/** Urgent scenarios still in the inbox; the term can't advance until they're resolved. */
export function blockingScenarios(session: TrainingSession, scenarios: Scenario[]): Scenario[] {
  return scenarios.filter((s) => s.urgent && session.inbox.includes(s.id));
}

/**
 * Moves to the next term: commitments still open and due are missed, then
 * delayed effects that come due are applied, then the arc's role change for
 * the new term (if any) takes effect. Pass the arc the session started with.
 */
export function advanceTerm(
  session: TrainingSession,
  scenarios: Scenario[],
  arc?: Arc,
): { session: TrainingSession; applied: PendingEffect[]; missed: Commitment[]; drift: string[]; milestones: string[] } {
  checkArc(session, arc);
  if (session.ending) throw new Error(`${arc?.title ?? "This session"} has ended.`);
  if (isFinalTerm(session, arc)) throw new Error(`${termLabel(session.termIndex)} is the final term of ${arc!.title}.`);
  const blocked = blockingScenarios(session, scenarios);
  if (blocked.length) {
    throw new Error(`Resolve before ${termLabel(session.termIndex)} ends: ${blocked.map((s) => s.title).join(", ")}`);
  }
  if (staffingDue(session, arc, scenarios)) throw new Error(`Some ${termLabel(session.termIndex)} sections still have no instructor.`);
  if (reportDue(session, arc)) throw new Error(`Submit the year-end report before ${termLabel(session.termIndex)} ends.`);
  // Order matters: close out the ending term (missed commitments, turnover
  // judged on the morale people actually worked under), then land the
  // consequences that come due in the new term.
  const record = recordTerm(session);
  const closed = missOverdue(session);
  const attrition = applyMoraleAttrition(closed.session.program);
  const termIndex = session.termIndex + 1;
  const applied = closed.session.pending.filter((p) => p.dueTerm <= termIndex);
  const program = applyChanges(attrition.program, applied.flatMap((p) => p.changes));
  const stageChange = arc && stageChangeAt(arc, termIndex);
  const timeCost = timeCostAt(arc, termIndex);
  const advanced: TrainingSession = {
    ...closed.session,
    program,
    termIndex,
    stage: stageChange?.stage ?? session.stage,
    adminHoursRemaining: Math.max(0, session.adminHoursPerTerm - (timeCost?.hours ?? 0)),
    overtimeHours: 0,
    history: [...session.history, record],
    pending: closed.session.pending.filter((p) => p.dueTerm > termIndex),
  };
  return {
    session: deliver(advanced, scenarios, arc),
    applied,
    missed: closed.missed,
    drift: attrition.notes,
    milestones: [...(stageChange ? [stageChange.note] : []), ...(timeCost ? [timeCost.note] : [])],
  };
}

/**
 * Adds newly eligible scenarios to the inbox. A scenario's arrival changes
 * (e.g., instructors resigning) apply only if the scenario actually arrives,
 * and eligibility is judged with those changes in place.
 */
function deliver(session: TrainingSession, scenarios: Scenario[], arc: Arc | undefined): TrainingSession {
  const done = new Set(session.decisions.map((d) => d.scenarioId));
  const inbox = session.inbox.filter((id) => !done.has(id));
  let program = session.program;
  for (const s of scenarios) {
    if (done.has(s.id) || inbox.includes(s.id)) continue;
    if (arc && !arcAllows(arc, s.id, session.termIndex)) continue;
    const withArrival = s.arrival.length ? applyChanges(program, s.arrival) : program;
    if (isEligible(s, { ...session, program: withArrival })) {
      program = withArrival;
      inbox.push(s.id);
    }
  }
  return { ...session, program, inbox };
}

function trustOf(session: TrainingSession, id: string): number {
  return session.program.stakeholders.find((s) => s.id === id)?.trust ?? 0;
}

function chooseReply(r: Reply, trust: number): { from: Reply["from"]; body: string } {
  const body = trust >= REPLY_TONE.warmAt && r.warm ? r.warm : trust < REPLY_TONE.coolBelow && r.cool ? r.cool : r.body;
  return { from: r.from, body };
}

/**
 * Fills a computed change's named amounts from the program as it stands.
 * Amounts are whole dollars; `times` scales them (e.g., -1 to take one back).
 */
export function resolveAmounts(program: Program, term: Term, c: ComputedChange): ProgramChange {
  const values: Record<string, number> = {};
  for (const [field, ref] of Object.entries(c.amounts)) {
    let v: number;
    if (ref.of === "deficit") {
      v = Math.max(0, -analyzeTerm(program, ref.term ?? term, DEFAULT_ASSUMPTIONS).budgetBalance);
    } else {
      const pool = program.instructors.find((p) => p.rank === ref.rank);
      if (!pool) throw new Error(`No ${ref.rank} pool to take pay from`);
      v = pool.costPerSection;
    }
    values[field] = Math.round(v * (ref.times ?? 1));
  }
  return { ...c.change, ...values } as ProgramChange;
}

/** A computed change that came out to nothing (e.g., covering a deficit of $0). */
function isNoop(c: ProgramChange): boolean {
  return c.kind === "adjustBudget" && c.delta === 0;
}

/** Turns scenario changes into concrete ProgramChanges against the current program. */
function resolveChanges(program: Program, term: ReturnType<typeof termOf>, changes: ScenarioChange[]): ProgramChange[] {
  let working = program;
  const out: ProgramChange[] = [];
  for (const c of changes) {
    let concrete: ProgramChange;
    if (c.kind === "computed") {
      // Named amounts refer to the program as the player found it, before this decision.
      concrete = resolveAmounts(program, term, c);
      if (isNoop(concrete)) continue;
    } else if (c.kind === "cancelUnstaffed") {
      const a = analyzeTerm(working, term, DEFAULT_ASSUMPTIONS);
      const course = a.courses.find((x) => x.courseId === c.courseId);
      if (!course) throw new Error(`Unknown course: ${c.courseId}`);
      const sections = Math.min(course.sectionsNeeded, course.sectionsCancelled + a.unstaffedSections);
      concrete = { kind: "cancelSections", courseId: c.courseId, term, sections };
    } else {
      concrete = c;
    }
    out.push(concrete);
    working = applyChanges(working, [concrete]);
  }
  return out;
}
