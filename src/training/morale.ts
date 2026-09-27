import { applyChanges, RANK_LABELS, type Program, type Rank } from "../model";

/**
 * When an instructor pool's morale falls below the threshold, one person
 * leaves at the end of each term until morale recovers.
 */
export const MORALE_ATTRITION = { threshold: 40, ranks: ["adjunct", "ntt"] as Rank[] } as const;

export function applyMoraleAttrition(program: Program): { program: Program; notes: string[] } {
  const notes: string[] = [];
  let next = program;
  for (const rank of MORALE_ATTRITION.ranks) {
    const pool = next.instructors.find((p) => p.rank === rank);
    if (!pool || pool.headcount === 0 || pool.morale >= MORALE_ATTRITION.threshold) continue;
    next = applyChanges(next, [{ kind: "adjustHeadcount", rank, delta: -1 }]);
    notes.push(
      `Morale among ${RANK_LABELS[rank].toLowerCase()} is low (${pool.morale}), and one of them didn't come back this term.`,
    );
  }
  return { program: next, notes };
}
