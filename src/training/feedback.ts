/**
 * The ending's feedback: what the player needs to work on, and what they did
 * well, stated plainly and tied to their own decisions and numbers. The
 * point is the honest conversation a good advisor has after a job search,
 * not a softened grade.
 */
import type { StakeholderId } from "../model";
import { COMMITMENT_EFFECTS } from "./commitments";
import { STAFFING_EFFECTS } from "./staffing";
import { termLabel } from "./terms";
import type { Arc, DissertationStatus, EndingFactor, FeedbackItem, Scenario, TrainingSession } from "./types";

/**
 * Below `weak` share of a factor's points, it's something to work on; at or
 * above `strong`, something done well. A decision is named as costly only if
 * it lost at least `notableLoss` trust with the people concerned.
 */
export const FEEDBACK_THRESHOLDS = { weak: 0.6, strong: 0.8, notableLoss: -3 } as const;

export function endingFeedback(
  session: TrainingSession,
  arc: Arc,
  factors: EndingFactor[],
  dissertation: DissertationStatus,
  gated: boolean,
  scenarios: Scenario[],
): { workOn: FeedbackItem[]; didWell: FeedbackItem[] } {
  const share = (f: EndingFactor) => f.points / f.max;
  const byWeakness = [...factors].sort((a, b) => share(a) - share(b));
  const weak = byWeakness.filter((f) => share(f) < FEEDBACK_THRESHOLDS.weak || (f.id === "dissertation" && gated));
  // There's always something to work on: if nothing fell short, name the weakest area.
  const toWorkOn = weak.length ? weak : byWeakness.slice(0, 1).filter((f) => share(f) < 1);
  const ctx = { session, arc, dissertation, scenarios };
  return {
    workOn: toWorkOn.map((f) => ({ factorId: f.id, heading: f.label, text: workOn(f, ctx) })),
    didWell: factors
      .filter((f) => share(f) >= FEEDBACK_THRESHOLDS.strong && !toWorkOn.includes(f))
      .map((f) => ({ factorId: f.id, heading: f.label, text: didWell(f, ctx, toWorkOn.length) })),
  };
}

interface Ctx {
  session: TrainingSession;
  arc: Arc;
  dissertation: DissertationStatus;
  scenarios: Scenario[];
}

function workOn(f: EndingFactor, { session, arc, dissertation, scenarios }: Ctx): string {
  const final = session.history[session.history.length - 1]!;
  switch (f.id) {
    case "program": {
      const out: string[] = [];
      const base = session.baseline;
      const like = [...session.history].reverse().find((h) => h.term === base.term) ?? final;
      const dfwChange = (like.dfw.mid - base.dfw.mid) * 100;
      if (dfwChange >= 0.5) {
        out.push(
          `Projected D/F/W rose ${dfwChange.toFixed(1)} points while you were in the program office. Decisions that put more students in each section put more of them at risk of failing or withdrawing.`,
        );
      }
      const lost = session.history.filter((h) => h.unstaffedSections > 0 || h.seatsUnserved > 0);
      if (lost.length) {
        out.push(
          `In ${list(lost.map((h) => termLabel(h.termIndex)))}, students couldn't get a section. Every way of covering a gap costs someone; a cancelled section costs students a term of progress, and it's the cost they can least recover.`,
        );
      }
      const finalYear = session.history.slice(-2).reduce((n, h) => n + h.budgetBalance, 0);
      if (finalYear < 0) out.push("You left the next director an instruction line in deficit.");
      out.push("Before you agree to a change, run it through the cap calculator or staffing planner for both terms, and look at who absorbs it.");
      return out.join(" ");
    }
    case "recommender": {
      const who = arc.endings!.recommender;
      const t = trustAt(session, who);
      const hurt = costliest(session, [who], scenarios);
      return [
        `Your supervisor's trust ended at ${t}. That letter is the one search committees read most closely, and at this level it will be careful and polite, which committees read as a warning.`,
        hurt.length ? `What cost the most: ${hurt.join("; ")}.` : "",
        "Supervisors write strong letters for people who try the hard conversation first, bring the numbers, and call before a big move, not after.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "relationships": {
      const who = arc.endings!.relationships;
      const avg = Math.round(who.reduce((n, s) => n + trustAt(session, s), 0) / who.length);
      const hurt = costliest(session, who, scenarios);
      const persuasion = persuasionFailures(session, scenarios);
      return [
        `Average trust with the people who make decisions ended at ${avg}.`,
        hurt.length ? `What cost the most: ${hurt.join("; ")}.` : "",
        persuasion,
        "Trust is built before you need it: consult early, keep people informed, and give readers what they need to defend a decision to their own boss.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "instructors": {
      const who: StakeholderId[] = ["adjunct_faculty", "gta_cohort"];
      const hurt = costliest(session, who, scenarios);
      return [
        f.explanation.replace(/ Candidates are asked.*$/, ""),
        hurt.length ? `What cost the most: ${hurt.join("; ")}.` : "",
        "The people who teach most of the sections notice who pays for each decision and who hears about it first. Search committees will ask how you supported them.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "commitments": {
      const kept = session.commitments.filter((c) => c.status === "kept").length;
      const missed = session.commitments.filter((c) => c.status === "missed").length;
      if (kept + missed === 0) {
        return "You never made a commitment in a memo, so there's no record of follow-through. Committees ask for examples of promises kept. Next time, promise something specific in a memo, and deliver it.";
      }
      return `You missed ${missed} of the ${kept + missed} commitments that came due. A missed commitment costs more trust than a kept one earns (${COMMITMENT_EFFECTS.missedTrust} against +${COMMITMENT_EFFECTS.keptTrust}). Promise less, match each promise to the hours you'll actually have, and deliver early when you can.`;
    }
    case "dissertation": {
      const spec = arc.dissertation!;
      const perTerm = Math.ceil((spec.hoursToFinish * spec.onTrackAt) / arc.terms);
      const leanest = [...session.history]
        .sort((a, b) => a.adminHoursUnspent - b.adminHoursUnspent)
        .slice(0, 2)
        .map((h) => `${termLabel(h.termIndex)} (${Math.max(0, h.adminHoursUnspent)} hours)`);
      const taught = session.staffingLog.filter((d) => d.choice === "teach").length;
      return [
        `Your dissertation is ${Math.round(dissertation.progress * 100)}% done: ${dissertation.hours} of the ${spec.hoursToFinish} hours it needs. To stay on track you needed about ${perTerm} unspent hours a term; your leanest terms were ${leanest.join(" and ")}.`,
        taught ? `Teaching ${taught === 1 ? "a section" : `${taught} sections`} yourself cost ${taught * STAFFING_EFFECTS.teachHours} of those hours.` : "",
        "Administrative work will take every hour you give it. Decide what the dissertation gets each term first, and fit the job around it.",
      ]
        .filter(Boolean)
        .join(" ");
    }
    default:
      return f.explanation;
  }
}

function didWell(f: EndingFactor, { session, arc }: Ctx, weakCount: number): string {
  switch (f.id) {
    case "program":
      return "The program came through your three years in good shape: " + f.explanation.charAt(0).toLowerCase() + f.explanation.slice(1);
    case "recommender":
      return `Your supervisor's trust ended at ${trustAt(session, arc.endings!.recommender)}. That letter will be a strong one.`;
    case "relationships":
      return "You kept the trust of the people who make decisions, which is most of what a WPA can spend.";
    case "instructors":
      return "Instructors trusted you and stayed. That's rarer than it should be, and committees will ask about it.";
    case "commitments":
      return f.explanation.replace(/\.$/, "") + ". Follow-through is the easiest thing to claim and the hardest to show; you can show it.";
    case "dissertation":
      return weakCount >= 3
        ? "Your dissertation is in good shape. Be honest with yourself about why: part of it is time the job needed and didn't get."
        : "You protected the dissertation while doing the job, which many assistant directors don't manage.";
    default:
      return f.explanation;
  }
}

function trustAt(session: TrainingSession, id: StakeholderId): number {
  const final = session.history[session.history.length - 1];
  return final?.trust.find((t) => t.stakeholder === id)?.trust ?? session.program.stakeholders.find((s) => s.id === id)?.trust ?? 0;
}

/** The two decisions that cost the most trust with these stakeholders, described. */
function costliest(session: TrainingSession, who: readonly StakeholderId[], scenarios: Scenario[]): string[] {
  return session.decisions
    .map((d) => {
      const loss = (d.snapshot?.trustChanges ?? [])
        .filter((t) => who.includes(t.stakeholder))
        .reduce((n, t) => n + (t.after - t.before), 0);
      return { d, loss };
    })
    .filter((x) => x.loss <= FEEDBACK_THRESHOLDS.notableLoss)
    .sort((a, b) => a.loss - b.loss)
    .slice(0, 2)
    .map(({ d, loss }) => {
      const s = scenarios.find((x) => x.id === d.scenarioId);
      const o = s?.options.find((x) => x.id === d.optionId);
      return `${s?.title ?? d.scenarioId}, where you chose "${o?.label ?? d.optionId}" (−${Math.abs(loss)} trust)`;
    });
}

/** Memos that didn't persuade, and why, in a sentence (or nothing). */
function persuasionFailures(session: TrainingSession, scenarios: Scenario[]): string {
  const failed = session.decisions.filter((d) => d.persuaded === false);
  if (!failed.length) return "";
  const noEvidence = failed.filter((d) => (d.snapshot?.missingEvidence.length ?? 0) > 0);
  const title = (id: string) => scenarios.find((s) => s.id === id)?.title ?? id;
  const parts: string[] = [];
  if (noEvidence.length) {
    parts.push(
      `${noEvidence.length === 1 ? "A memo" : `${noEvidence.length} memos`} (${noEvidence.map((d) => title(d.scenarioId)).join(", ")}) didn't persuade because ${noEvidence.length === 1 ? "it" : "they"} lacked the evidence the reader needed. Before you write to a decision-maker, ask what they have to defend upstairs, and bring that number.`,
    );
  }
  const lowTrust = failed.length - noEvidence.length;
  if (lowTrust) {
    parts.push(
      `${lowTrust === 1 ? "One memo had" : `${lowTrust} memos had`} the right evidence but not enough trust behind ${lowTrust === 1 ? "it" : "them"}.`,
    );
  }
  return parts.join(" ");
}

function list(items: string[]): string {
  return items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
