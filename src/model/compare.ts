import type { TermAnalysis } from "./analyze";
import type { Rank } from "./types";

/** Before/after differences between two analyses of the same term. */
export interface TermComparison {
  sections: number;
  programCost: number;
  budgetBalance: number;
  dfwMid: number;
  unstaffedSections: number;
  seatsUnserved: number;
  /** Change in overload sections per rank. */
  overloadSectionsByRank: Partial<Record<Rank, number>>;
  /** Change in sections per instructor rank (negative means lost work). */
  sectionsByRank: Partial<Record<Rank, number>>;
  /** Change in the number of people in each rank with no sections. */
  peopleWithoutSectionsByRank: Partial<Record<Rank, number>>;
  /**
   * Plain-language notes for courses whose cap changed but whose section
   * count did not, so "nothing happened" explains itself.
   */
  courseNotes: string[];
}

export function compareTerms(before: TermAnalysis, after: TermAnalysis): TermComparison {
  const sectionsByRank: Partial<Record<Rank, number>> = {};
  const peopleWithoutSectionsByRank: Partial<Record<Rank, number>> = {};
  const overloadSectionsByRank: Partial<Record<Rank, number>> = {};
  for (const a of after.staffing) {
    const b = before.staffing.find((s) => s.rank === a.rank);
    overloadSectionsByRank[a.rank] = a.overloadSections - (b?.overloadSections ?? 0);
    sectionsByRank[a.rank] = a.sectionsAssigned - (b?.sectionsAssigned ?? 0);
    peopleWithoutSectionsByRank[a.rank] = a.peopleWithoutSections - (b?.peopleWithoutSections ?? 0);
  }
  const courseNotes: string[] = [];
  for (const a of after.courses) {
    const b = before.courses.find((c) => c.courseId === a.courseId);
    if (!b || b.cap === a.cap || b.sectionsNeeded !== a.sectionsNeeded || a.seats === 0) continue;
    const head =
      `${a.courseId}: ${a.seats} seats at a cap of ${a.cap} is ${a.exactSections.toFixed(1)} sections' worth, ` +
      `which still takes ${a.sectionsNeeded} whole sections, so cost and class size don't change.`;
    if (a.cap > b.cap) {
      const needed = a.sectionsNeeded > 1 ? Math.ceil(a.seats / (a.sectionsNeeded - 1)) : null;
      courseNotes.push(needed ? `${head} A cap of ${needed} would be needed to drop one section.` : head);
    } else {
      const extra = Math.ceil(a.seats / a.sectionsNeeded) - 1;
      courseNotes.push(`${head} A cap of ${extra} or lower would require an extra section.`);
    }
  }

  return {
    sections: after.totalSections - before.totalSections,
    programCost: after.cost.program - before.cost.program,
    budgetBalance: after.budgetBalance - before.budgetBalance,
    dfwMid: after.dfw.mid - before.dfw.mid,
    unstaffedSections: after.unstaffedSections - before.unstaffedSections,
    seatsUnserved: after.totalSeatsUnserved - before.totalSeatsUnserved,
    overloadSectionsByRank,
    sectionsByRank,
    peopleWithoutSectionsByRank,
    courseNotes,
  };
}
