import type { Term } from "../model";

/** Term index 1 is fall of year 1; terms alternate fall/spring. */
export function termOf(termIndex: number): Term {
  return termIndex % 2 === 1 ? "fall" : "spring";
}

export function yearOf(termIndex: number): number {
  return Math.ceil(termIndex / 2);
}

export function termLabel(termIndex: number): string {
  return `${termOf(termIndex) === "fall" ? "Fall" : "Spring"}, Year ${yearOf(termIndex)}`;
}
