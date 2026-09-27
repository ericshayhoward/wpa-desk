import type { Program, StakeholderId } from "../model";

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

export function stakeholderName(program: Program, id: StakeholderId): string {
  return program.stakeholders.find((s) => s.id === id)?.name ?? id;
}
