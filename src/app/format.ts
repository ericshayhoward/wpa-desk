import type { Program, StakeholderId } from "../model";
import { CAST } from "../content";
import { characterFor, type Names } from "../training";

/** Trust meter bands, shared by the People card and the campus flags. */
export const TRUST_METER = { low: 35, high: 65, optimum: 80 } as const;

export function usd(n: number): string {
  const s = `$${Math.round(Math.abs(n)).toLocaleString("en-US")}`;
  return n < 0 ? `−${s}` : s;
}

export function signed(n: number, digits = 0): string {
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

export function pct(x: number, digits = 1): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** How a stakeholder is named in the UI: the character's name if there is one, else the role. */
export function stakeholderName(program: Program, id: StakeholderId): string {
  return characterFor(CAST, id)?.shortName ?? program.stakeholders.find((s) => s.id === id)?.name ?? id;
}

/** Full name and role, for letterheads: "Edwin Alvarez, Dean of Arts & Sciences". */
export function stakeholderByline(program: Program, id: StakeholderId): string {
  const c = characterFor(CAST, id);
  return c ? `${c.name}, ${c.title}` : stakeholderName(program, id);
}

/** Name lookups for training-layer text (case files, persuasion summaries). */
export function namesFor(program: Program): Names {
  return { short: (id) => stakeholderName(program, id), byline: (id) => stakeholderByline(program, id) };
}
