import { DEFAULT_ASSUMPTIONS, analyzeTerm } from "../model";
import { termOf } from "./terms";
import type { TrainingSession } from "./types";

/**
 * Fills {{placeholders}} in scenario prose from the program's current state,
 * so a document can state the real numbers that earlier decisions produced.
 *
 *   {{unstaffed}}           → 3
 *   {{unstaffed_sections}}  → "3 sections" / "1 section"
 *   {{term}}                → "fall" / "spring"
 *   {{next_term}}           → the term after this one, for changes announced now
 *   {{deficit}}             → "$8,600" (0 if balanced)
 *   {{surplus}}             → "$41,800" (0 if in deficit)
 *   {{sections}}            → 60 (sections offered this term)
 *   {{sections_gta}}        → 15 (sections this term by any instructor rank)
 *   {{cap_ENGL101}}         → 24 (any course id)
 *   {{headcount_gta}}       → 15 (any instructor rank)
 *   {{pay_gta}}             → "$9,000" per section (any instructor rank)
 *
 * Scenario prose should state the program's numbers through placeholders,
 * never as fixed values, so it stays true when starting conditions vary.
 * Fixed numbers are fine for a scenario's own parameters (e.g., "caps of
 * 27", "$20,000 a term") when they match its changes.
 *
 * Unknown placeholders are left as-is so authoring mistakes stay visible.
 */
export function fillTemplate(text: string, session: TrainingSession): string {
  const term = termOf(session.termIndex);
  const a = analyzeTerm(session.program, term, DEFAULT_ASSUMPTIONS);
  const vars: Record<string, string> = {
    unstaffed: String(a.unstaffedSections),
    unstaffed_sections: `${a.unstaffedSections} section${a.unstaffedSections === 1 ? "" : "s"}`,
    term,
    next_term: termOf(session.termIndex + 1),
    deficit: `$${Math.max(0, -a.budgetBalance).toLocaleString("en-US")}`,
    surplus: `$${Math.max(0, a.budgetBalance).toLocaleString("en-US")}`,
    sections: String(a.totalSections),
  };
  for (const line of a.staffing) vars[`sections_${line.rank}`] = String(line.sectionsAssigned);
  for (const [id, cap] of Object.entries(session.program.policies.caps)) vars[`cap_${id}`] = String(cap);
  for (const p of session.program.instructors) {
    vars[`headcount_${p.rank}`] = String(p.headcount);
    vars[`pay_${p.rank}`] = `$${p.costPerSection.toLocaleString("en-US")}`;
  }
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => vars[key] ?? whole);
}
