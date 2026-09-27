import { RANK_LABELS, compareTerms, describeChange, type Program, type ProgramChange, type TermAnalysis } from "../model";
import type { Evidence } from "./types";

export type EvidenceDraft = Omit<Evidence, "id" | "termIndex">;

/** Turns a cap calculator comparison into evidence a memo can cite. */
export function capAnalysisEvidence(program: Program, proposedCaps: Record<string, number>, before: TermAnalysis, after: TermAnalysis): EvidenceDraft {
  const changed = Object.entries(proposedCaps).filter(([id, cap]) => cap !== program.policies.caps[id]);
  const diff = compareTerms(before, after);
  const term = before.term === "fall" ? "Fall" : "Spring";
  const capText = changed.length
    ? changed.map(([id, cap]) => `${id} ${program.policies.caps[id]}→${cap}`).join(", ")
    : "no change";

  const adj = (a: TermAnalysis) => a.staffing.find((s) => s.rank === "adjunct");
  const adjBefore = adj(before);
  const adjAfter = adj(after);

  const summary = [
    `Proposed caps (${term} term): ${capText}.`,
    `Sections: ${before.totalSections} → ${after.totalSections} (${signed(diff.sections)}).`,
    `Program instruction cost: ${usd(before.cost.program)} → ${usd(after.cost.program)}; ` +
      `budget balance ${usd(before.budgetBalance)} → ${usd(after.budgetBalance)}.`,
    `Projected D/F/W: ${pct(before.dfw.mid)} → ${pct(after.dfw.mid)} ` +
      `(plausible range ${pct(after.dfw.low)}–${pct(after.dfw.high)}).`,
  ];
  if (adjBefore && adjAfter) {
    const lost = adjAfter.sectionsAssigned - adjBefore.sectionsAssigned;
    if (lost !== 0) {
      summary.push(`Adjunct sections: ${adjBefore.sectionsAssigned} → ${adjAfter.sectionsAssigned} (${signed(lost)}).`);
    }
    summary.push(
      `An adjunct with a full load teaches ${Math.round(adjBefore.studentsPerFullLoad)} → ` +
        `${Math.round(adjAfter.studentsPerFullLoad)} students, about ` +
        `${Math.round(adjBefore.feedbackHoursPerFullLoad.mid)} → ${Math.round(adjAfter.feedbackHoursPerFullLoad.mid)} ` +
        `hours of feedback per term.`,
    );
  }

  summary.push(...diff.courseNotes);

  return {
    kind: "cap_analysis",
    label: `Cap analysis: ${capText} (${term})`,
    summary,
    data: { term: before.term, proposedCaps: { ...proposedCaps }, comparison: diff },
  };
}

/** Turns a staffing planner comparison into evidence a memo can cite. */
export function staffingPlanEvidence(
  program: Program,
  changes: ProgramChange[],
  before: TermAnalysis,
  after: TermAnalysis,
): EvidenceDraft {
  const diff = compareTerms(before, after);
  const term = before.term === "fall" ? "Fall" : "Spring";
  const plan = changes.map((c) => describeChange(program, c));
  const summary = [
    `Staffing plan (${term} term): ${plan.length ? plan.join("; ") : "no changes"}.`,
    `Unstaffed sections: ${before.unstaffedSections} → ${after.unstaffedSections}.`,
  ];
  if (after.totalSectionsCancelled > 0 || before.totalSectionsCancelled > 0) {
    summary.push(
      `Sections cancelled: ${before.totalSectionsCancelled} → ${after.totalSectionsCancelled}; ` +
        `students without a seat: ${before.totalSeatsUnserved} → ${after.totalSeatsUnserved}.`,
    );
  }
  for (const a of after.staffing) {
    const b = before.staffing.find((s) => s.rank === a.rank);
    if (!b || (a.sectionsAssigned === b.sectionsAssigned && a.overloadSections === b.overloadSections)) continue;
    const overload = a.overloadSections || b.overloadSections ? ` (overloads ${b.overloadSections} → ${a.overloadSections})` : "";
    summary.push(`${RANK_LABELS[a.rank]}: ${b.sectionsAssigned} → ${a.sectionsAssigned} sections${overload}.`);
  }
  summary.push(
    `Program instruction cost: ${usd(before.cost.program)} → ${usd(after.cost.program)}; ` +
      `budget balance ${usd(before.budgetBalance)} → ${usd(after.budgetBalance)}.`,
  );
  if (diff.dfwMid !== 0) {
    summary.push(`Projected D/F/W: ${pct(before.dfw.mid)} → ${pct(after.dfw.mid)}.`);
  }

  return {
    kind: "staffing_plan",
    label: `Staffing plan: ${plan.length ? plan.join("; ") : "no changes"} (${term})`,
    summary,
    data: { term: before.term, changes, comparison: diff },
  };
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function usd(n: number): string {
  const s = `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  return n < 0 ? `−${s}` : s;
}
