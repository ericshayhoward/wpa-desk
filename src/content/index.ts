/**
 * Loads authored content. Scenario files are plain YAML so non-programmers
 * can write them; every file is validated on load, and a bad file fails
 * loudly with the exact field that's wrong.
 */
import { parse } from "yaml";
import {
  parseArc,
  parseCast,
  parseScenario,
  validateScenarioLinks,
  type Arc,
  type Character,
  type Scenario,
} from "../training";
import castYaml from "./cast/midland-state.yaml?raw";

const files = import.meta.glob("./scenarios/*.yaml", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

export const SCENARIOS: Scenario[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, raw]) => {
    try {
      return parseScenario(parse(raw));
    } catch (err) {
      throw new Error(`${path}: ${(err as Error).message}`);
    }
  });

validateScenarioLinks(SCENARIOS);

const arcFiles = import.meta.glob("./arcs/*.yaml", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

export const ARCS: Arc[] = Object.entries(arcFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, raw]) => {
    try {
      return parseArc(parse(raw), SCENARIOS);
    } catch (err) {
      throw new Error(`${path}: ${(err as Error).message}`);
    }
  });

/** Three years as assistant director, ending with the Year 3 annual report. */
export const STANDARD_ARC: Arc = ARCS.find((a) => a.id === "standard")!;

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

/** The named people at Midland State. */
export const CAST: Character[] = (() => {
  try {
    return parseCast(parse(castYaml));
  } catch (err) {
    throw new Error(`./cast/midland-state.yaml: ${(err as Error).message}`);
  }
})();
