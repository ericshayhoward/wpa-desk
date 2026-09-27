import { compareTerms, type Program, type TermAnalysis } from "../model";
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
