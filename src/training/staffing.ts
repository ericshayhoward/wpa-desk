/**
 * Routine staffing. When a term has sections without an instructor and no
 * scenario is already dealing with it, the director decides: hire adjuncts,
 * teach a section themselves, or cancel. It blocks the term like a report.
 * Only arcs with `routineStaffing` use it; free play runs on triggers alone.
 */
import { DEFAULT_ASSUMPTIONS, analyzeTerm, applyChanges, type ProgramChange } from "../model";
import { termLabel, termOf } from "./terms";
import type { Arc, PendingEffect, Scenario, StaffingDecision, TrainingSession } from "./types";

export type StaffingChoice = StaffingDecision["choice"];

/**
 * Costs and effects. Teaching a section is far more work than any admin
 * task; the hours come out of the term, and past that, the dissertation.
 */
export const STAFFING_EFFECTS = {
  hireHours: 2,
  teachHours: 20,
  teachTrust: { adjunct_faculty: 2, gta_cohort: 3, fyw_director: 1 },
  cancelTrust: { students: -4, provost_office: -2 },
} as const;

export const STAFFING_LABELS: Record<StaffingChoice, string> = {
  hire: "Hire adjuncts to cover them",
  teach: "Teach a section yourself",
  cancel: "Cancel the uncovered sections",
};

/** Uncovered sections waiting on a staffing decision, or null. */
export function staffingDue(session: TrainingSession, arc: Arc | undefined, scenarios: Scenario[]): { unstaffed: number } | null {
  if (!arc?.routineStaffing || session.ending) return null;
  // A scenario about the gap (The Late Hire) handles it instead.
  if (scenarios.some((s) => s.trigger.requiresUnstaffed && session.inbox.includes(s.id))) return null;
  const a = analyzeTerm(session.program, termOf(session.termIndex), DEFAULT_ASSUMPTIONS);
  return a.unstaffedSections > 0 ? { unstaffed: a.unstaffedSections } : null;
}

/** Applies a staffing decision and returns what happened, in a sentence. */
export function resolveStaffing(
  session: TrainingSession,
  arc: Arc | undefined,
  scenarios: Scenario[],
  choice: StaffingChoice,
): { session: TrainingSession; note: string } {
  const due = staffingDue(session, arc, scenarios);
  if (!due) throw new Error("No sections are waiting for an instructor.");
  const term = termOf(session.termIndex);
  const n = due.unstaffed;
  const adjunctLoad = session.program.instructors.find((p) => p.rank === "adjunct")?.sectionsPerTerm || 3;
  const hires = (sections: number) => Math.ceil(sections / adjunctLoad);

  let changes: ProgramChange[] = [];
  let hours = 0;
  let restore: ProgramChange[] = [];
  let note: string;
  switch (choice) {
    case "hire":
      hours = STAFFING_EFFECTS.hireHours;
      changes = [{ kind: "adjustHeadcount", rank: "adjunct", delta: hires(n) }];
      note = `You hired ${hires(n)} adjunct${hires(n) === 1 ? "" : "s"} to cover ${plural(n, "section")}.`;
      break;
    case "teach": {
      hours = STAFFING_EFFECTS.teachHours;
      // You teach one section this term, at graduate pay; any others are hired for.
      changes = [
        { kind: "adjustHeadcount", rank: "gta", delta: 1 },
        ...(n > 1 ? [{ kind: "adjustHeadcount" as const, rank: "adjunct" as const, delta: hires(n - 1) }] : []),
        ...Object.entries(STAFFING_EFFECTS.teachTrust).map(([stakeholder, delta]) => ({
          kind: "adjustTrust" as const,
          stakeholder: stakeholder as keyof typeof STAFFING_EFFECTS.teachTrust,
          delta,
        })),
      ];
      restore = [{ kind: "adjustHeadcount", rank: "gta", delta: -1 }];
      note = `You're teaching a section yourself this term${n > 1 ? `, and hired for the other ${plural(n - 1, "section")}` : ""}.`;
      break;
    }
    case "cancel": {
      const a = analyzeTerm(session.program, term, DEFAULT_ASSUMPTIONS);
      const course = [...a.courses].sort((x, y) => y.sections - x.sections)[0]!;
      changes = [
        { kind: "cancelSections", courseId: course.courseId, term, sections: Math.min(course.sectionsNeeded, course.sectionsCancelled + n) },
        ...Object.entries(STAFFING_EFFECTS.cancelTrust).map(([stakeholder, delta]) => ({
          kind: "adjustTrust" as const,
          stakeholder: stakeholder as keyof typeof STAFFING_EFFECTS.cancelTrust,
          delta,
        })),
      ];
      restore = [{ kind: "cancelSections", courseId: course.courseId, term, sections: course.sectionsCancelled }];
      note = `You cancelled ${plural(n, `${course.courseId} section`)}, and those students are looking for seats.`;
      break;
    }
  }

  const shortfall = Math.max(0, hours - session.adminHoursRemaining);
  const pending: PendingEffect[] = restore.length
    ? [
        {
          inTerms: 1,
          dueTerm: session.termIndex + 1,
          scenarioId: "staffing",
          note:
            choice === "teach"
              ? `Your extra section from ${termLabel(session.termIndex)} is over.`
              : `The sections cancelled in ${termLabel(session.termIndex)} are back on the schedule.`,
          changes: restore,
        },
      ]
    : [];
  return {
    session: {
      ...session,
      program: applyChanges(session.program, changes),
      adminHoursRemaining: Math.max(0, session.adminHoursRemaining - hours),
      overtimeHours: session.overtimeHours + shortfall,
      pending: [...session.pending, ...pending],
      staffingLog: [...session.staffingLog, { termIndex: session.termIndex, choice, sections: n }],
    },
    note,
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
