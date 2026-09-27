/**
 * Instructor review: summaries across one or many student sessions.
 * Pure functions, so a hosted version can compute the same thing server-side.
 */
import { wordCount, draftingMinutes } from "./drafts";
import { termLabel } from "./terms";
import type { Scenario, TrainingSession } from "./types";

export interface StudentSummary {
  author: string;
  course: string;
  term: string;
  termIndex: number;
  decisions: number;
  memos: number;
  /** Words across sent memos. */
  memoWords: number;
  /** Minutes from opening to sending, summed over memos where it's known. */
  draftingMinutes: number;
  savedDrafts: number;
  portfolioRevisions: number;
  largeInsertions: number;
  reflections: number;
  reflectionWords: number;
  commitmentsKept: number;
  commitmentsMissed: number;
  commitmentsOpen: number;
}

export function studentSummary(session: TrainingSession): StudentSummary {
  const history = session.dossier.flatMap((m) => m.history ?? []);
  const count = (reason: string) => history.filter((v) => v.reason === reason).length;
  const reflections = session.decisions.filter((d) => d.reflection);
  const commitments = (status: string) => session.commitments.filter((c) => c.status === status).length;
  return {
    author: session.portfolio?.author || "",
    course: session.portfolio?.course || "",
    term: termLabel(session.termIndex),
    termIndex: session.termIndex,
    decisions: session.decisions.length,
    memos: session.dossier.length,
    memoWords: session.dossier.reduce((n, m) => n + wordCount(m.body), 0),
    draftingMinutes: session.dossier.reduce((n, m) => n + (draftingMinutes(m.startedAt, m.history) ?? 0), 0),
    savedDrafts: count("draft"),
    portfolioRevisions: count("revision"),
    largeInsertions: count("large-change"),
    reflections: reflections.length,
    reflectionWords: reflections.reduce((n, d) => n + wordCount(d.reflection ?? ""), 0),
    commitmentsKept: commitments("kept"),
    commitmentsMissed: commitments("missed"),
    commitmentsOpen: commitments("open"),
  };
}

export interface ScenarioSummary {
  scenario: Scenario;
  responded: number;
  options: {
    id: string;
    label: string;
    count: number;
    /** For persuasion options: how many memos landed. */
    persuaded: number | null;
    /** Which students chose it (display names). */
    students: string[];
  }[];
  memos: number;
  reflections: number;
}

/** How a class responded to each scenario, for seminar discussion. */
export function scenarioSummaries(
  sessions: { name: string; session: TrainingSession }[],
  scenarios: Scenario[],
): ScenarioSummary[] {
  return scenarios.map((scenario) => {
    const decisions = sessions.flatMap(({ name, session }) =>
      session.decisions.filter((d) => d.scenarioId === scenario.id).map((d) => ({ name, d })),
    );
    return {
      scenario,
      responded: decisions.length,
      options: scenario.options.map((o) => {
        const chose = decisions.filter((x) => x.d.optionId === o.id);
        return {
          id: o.id,
          label: o.label,
          count: chose.length,
          persuaded: o.persuasion ? chose.filter((x) => x.d.persuaded).length : null,
          students: chose.map((x) => x.name),
        };
      }),
      memos: decisions.filter((x) => x.d.memoId).length,
      reflections: decisions.filter((x) => x.d.reflection).length,
    };
  });
}

const CSV_COLUMNS: [keyof StudentSummary | "file", string][] = [
  ["file", "File"],
  ["author", "Name"],
  ["course", "Course"],
  ["term", "Reached"],
  ["decisions", "Decisions"],
  ["memos", "Memos"],
  ["memoWords", "Memo words"],
  ["draftingMinutes", "Drafting minutes"],
  ["savedDrafts", "Saved drafts"],
  ["portfolioRevisions", "Portfolio revisions"],
  ["largeInsertions", "Large insertions"],
  ["reflections", "Reflections"],
  ["reflectionWords", "Reflection words"],
  ["commitmentsKept", "Commitments kept"],
  ["commitmentsMissed", "Commitments missed"],
  ["commitmentsOpen", "Commitments open"],
];

/** Class overview as CSV, for a gradebook or spreadsheet. */
export function summariesToCsv(rows: { file: string; summary: StudentSummary }[]): string {
  const cell = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    CSV_COLUMNS.map(([, label]) => cell(label)).join(","),
    ...rows.map((r) => CSV_COLUMNS.map(([k]) => cell(k === "file" ? r.file : r.summary[k])).join(",")),
  ].join("\n");
}
