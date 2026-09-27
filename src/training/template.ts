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
 *   {{deficit}}             → "$8,600" (0 if balanced)
 *   {{surplus}}             → "$41,800" (0 if in deficit)
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
    deficit: `$${Math.max(0, -a.budgetBalance).toLocaleString("en-US")}`,
    surplus: `$${Math.max(0, a.budgetBalance).toLocaleString("en-US")}`,
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key: string) => vars[key] ?? whole);
}
