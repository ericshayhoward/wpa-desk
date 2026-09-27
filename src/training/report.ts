/**
 * Year-end annual reports. The player writes some sections (all of them in a
 * capstone); the supervisor's sections are generated from the program's
 * recorded data. Reports are reflective: they're kept, exported, and read by
 * instructors, but never scored.
 */
import { RANK_LABELS, type StakeholderId } from "../model";
import { wordCount, type DraftVersion } from "./drafts";
import { computeEnding } from "./ending";
import { recordTerm } from "./history";
import { staffingDue } from "./staffing";
import { termLabel, yearOf } from "./terms";
import type {
  AnnualReport,
  Arc,
  ReportSection,
  ReportSectionId,
  Scenario,
  TermRecord,
  TrainingSession,
  YearEndSpec,
} from "./types";

export const REPORT_SECTIONS: Record<ReportSectionId, { title: string; prompt: string }> = {
  program_data: {
    title: "Program data",
    prompt:
      "Report sections, staffing, D/F/W, and the budget for the year, and say what the numbers mean. Your readers know the department but not these numbers, and the dean will read this for budget and results.",
  },
  assessment: {
    title: "Assessment and outcomes",
    prompt:
      "What did the program learn this year about student writing and student success? Name the evidence, what it shows, and what it can't show.",
  },
  initiatives: {
    title: "Initiatives",
    prompt: "What did the program change or start this year, and why? Who was consulted, and what came of it?",
  },
  requests: {
    title: "Requests for next year",
    prompt: "What does the program need next year? For each request, say what it would make possible and what it costs.",
  },
  looking_back: {
    title: "Looking back: three years",
    prompt:
      "What changed in the program over three years, and what didn't? What would you do differently, and what should the next director know?",
  },
};

/** The report due this term and not yet submitted, if any. */
export function reportDue(session: TrainingSession, arc: Arc | undefined): YearEndSpec | null {
  if (!arc || session.ending) return null;
  const spec = arc.yearEnd.find((y) => y.term === session.termIndex);
  if (!spec || session.reports.some((r) => r.termIndex === spec.term)) return null;
  return spec;
}

/**
 * The records a report covers: the year's terms (all terms, for a capstone),
 * with the current term as it stands now.
 */
export function reportRecords(session: TrainingSession, spec: YearEndSpec): TermRecord[] {
  const year = yearOf(spec.term);
  const first = spec.capstone ? 1 : year * 2 - 1;
  const past = session.history.filter((r) => r.termIndex >= first && r.termIndex < session.termIndex);
  return [...past, recordTerm(session)];
}

/** Plain-language data lines the player can quote, and the report's appendix. */
export function reportFacts(session: TrainingSession, spec: YearEndSpec, scenarios: Scenario[]): string[] {
  const records = reportRecords(session, spec);
  const last = records[records.length - 1]!;
  const lines = records.map(termLine);
  if (spec.capstone) {
    const b = session.baseline;
    lines.unshift(
      `When you started: ${b.totalSections} sections per term; projected D/F/W ${pct(b.dfw.low)}–${pct(b.dfw.high)}; ${budget(b.budgetBalance)}.`,
    );
  }
  lines.push(
    `Staffing now: ${last.instructors
      .filter((p) => p.headcount > 0)
      .map((p) => `${RANK_LABELS[p.rank].toLowerCase()} ${p.headcount} (morale ${p.morale})`)
      .join("; ")}.`,
  );
  const first = records[0]!.termIndex;
  const decisions = session.decisions.filter((d) => d.termIndex >= first);
  for (const d of decisions) {
    const s = scenarios.find((x) => x.id === d.scenarioId);
    const o = s?.options.find((x) => x.id === d.optionId);
    if (s && o) lines.push(`${s.title} (${termLabel(d.termIndex)}): ${o.label}.`);
  }
  const commitments = session.commitments.filter((c) => c.dueTerm >= first && c.dueTerm <= session.termIndex);
  if (commitments.length) {
    const n = (st: string) => commitments.filter((c) => c.status === st).length;
    lines.push(`Commitments due in this period: ${n("kept")} kept, ${n("missed")} missed, ${n("open")} still open.`);
  }
  return lines;
}

/** A section written by the supervisor, generated from the recorded data. */
export function generatedSection(
  id: ReportSectionId,
  session: TrainingSession,
  spec: YearEndSpec,
  scenarios: Scenario[],
): string {
  const records = reportRecords(session, spec);
  const last = records[records.length - 1]!;
  const first = records[0]!;
  const unstaffed = records.filter((r) => r.unstaffedSections > 0);
  switch (id) {
    case "program_data":
      return [
        `The program offered ${records.map((r) => `${r.totalSections} sections in ${r.term}`).join(" and ")}.`,
        unstaffed.length
          ? `Staffing fell short in ${unstaffed.map((r) => termLabel(r.termIndex)).join(" and ")}, leaving sections without an instructor at some point.`
          : "Every section had an instructor.",
        `Projected D/F/W across first-year writing was ${pct(last.dfw.low)}–${pct(last.dfw.high)} by year's end, against ${pct(first.dfw.low)}–${pct(first.dfw.high)} at its start.`,
        `The instruction line ended the year with ${budget(last.budgetBalance)}.`,
      ].join(" ");
    case "assessment":
      return session.program.policies.portfolioAssessment
        ? "The program assessed a sample of student portfolios against its outcomes this year; results are summarized in the appendix."
        : `The program has no program-wide assessment of student writing yet, so this year's evidence is limited to course completion. Projected D/F/W stands at ${pct(last.dfw.low)}–${pct(last.dfw.high)}. Building a direct assessment of student writing, ahead of the accreditation visit, remains a priority.`;
    case "initiatives": {
      const decided = session.decisions
        .filter((d) => d.termIndex >= first.termIndex)
        .flatMap((d) => {
          const s = scenarios.find((x) => x.id === d.scenarioId);
          const o = s?.options.find((x) => x.id === d.optionId);
          return s && o ? [`${s.title.replace(/^The /, "the ")} (${o.label.toLowerCase()})`] : [];
        });
      return decided.length
        ? `This year the program responded to ${list(decided)}. My assistant director did much of the analysis and drafting behind these decisions.`
        : "This was a year of steady operation without major changes to the program.";
    }
    case "requests":
      return last.budgetBalance < 0
        ? `The instruction line is running ${budget(last.budgetBalance)} per term. The program asks for a conversation about a stable funding level before next year's schedule is built, so that section counts aren't decided under deadline.`
        : "The program asks that the instruction line be held at its current level next year, and for support for instructor professional development.";
    case "looking_back":
      return "";
  }
}

/** Assembles and files the report from the player's drafted sections. Capstone reports end the arc. */
export function submitReport(
  session: TrainingSession,
  arc: Arc,
  scenarios: Scenario[],
  at: Date,
): { session: TrainingSession; report: AnnualReport } {
  const spec = reportDue(session, arc);
  if (!spec) throw new Error("No report is due this term.");
  if (staffingDue(session, arc, scenarios)) throw new Error("Cover this term's sections before submitting the report.");
  const draft = session.reportDraft?.termIndex === spec.term ? session.reportDraft : undefined;
  const missing = spec.playerSections.filter((id) => wordCount(draft?.sections[id]?.body ?? "") === 0);
  if (missing.length) {
    throw new Error(`Write your section${missing.length > 1 ? "s" : ""} first: ${missing.map((id) => REPORT_SECTIONS[id].title).join(", ")}.`);
  }

  const sections: ReportSection[] = spec.sections.map((id) => {
    const mine = spec.playerSections.includes(id);
    const written = draft?.sections[id];
    const body = mine ? written!.body.trim() : generatedSection(id, session, spec, scenarios);
    const history: DraftVersion[] | undefined = mine ? sentHistory(written!.history, REPORT_SECTIONS[id].title, body, at) : undefined;
    return { id, title: REPORT_SECTIONS[id].title, author: mine ? "player" : (spec.from as StakeholderId), body, ...(history && { history }) };
  });

  const report: AnnualReport = {
    termIndex: spec.term,
    year: yearOf(spec.term),
    from: spec.from,
    to: spec.to,
    capstone: spec.capstone,
    sections,
    appendix: reportFacts(session, spec, scenarios),
    startedAt: draft?.startedAt,
    submittedAt: at.toISOString(),
    reply: spec.reply && { from: spec.reply.from, body: spec.reply.body },
  };

  const shortfall = Math.max(0, spec.hours - session.adminHoursRemaining);
  let next: TrainingSession = {
    ...session,
    adminHoursRemaining: Math.max(0, session.adminHoursRemaining - spec.hours),
    overtimeHours: session.overtimeHours + shortfall,
    reports: [...session.reports, report],
    reportDraft: undefined,
  };
  if (spec.capstone) {
    next = { ...next, history: [...next.history, recordTerm(next)] };
    next = { ...next, ending: computeEnding(next, arc) };
  }
  return { session: next, report };
}

/** Keeps the draft being written, so it survives reloads. */
export function setReportDraft(session: TrainingSession, draft: TrainingSession["reportDraft"]): TrainingSession {
  return { ...session, reportDraft: draft };
}

function sentHistory(history: DraftVersion[], title: string, body: string, at: Date): DraftVersion[] {
  return [...history, { at: at.toISOString(), reason: "sent", subject: title, ask: "", body, words: wordCount(body) }];
}

function termLine(r: TermRecord): string {
  return `${termLabel(r.termIndex)}: ${r.totalSections} sections${r.unstaffedSections ? ` (${r.unstaffedSections} without an instructor)` : ""}; projected D/F/W ${pct(r.dfw.low)}–${pct(r.dfw.high)}; ${budget(r.budgetBalance)}.`;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function budget(balance: number): string {
  const amount = `$${Math.abs(Math.round(balance)).toLocaleString("en-US")}`;
  return balance < 0 ? `a ${amount} deficit` : balance === 0 ? "a balanced instruction budget" : `a ${amount} surplus`;
}

function list(items: string[]): string {
  return items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
