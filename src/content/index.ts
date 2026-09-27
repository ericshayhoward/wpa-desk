/**
 * Loads authored content. Scenario files are plain YAML so non-programmers
 * can write them; every file is validated on load, and a bad file fails
 * loudly with the exact field that's wrong.
 */
import { parse } from "yaml";
import { parseScenario, type Scenario } from "../training";

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

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
