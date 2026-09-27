import type { StakeholderId } from "../model";
import {
  DRAFT_REASON_LABELS,
  diffToMarkdown,
  draftingMinutes,
  latestRevision,
  wordCount,
  wordDiff,
  type DraftVersion,
} from "./drafts";
import { termLabel } from "./terms";
import {
  EVIDENCE_LABELS,
  SELF_ASSESSMENT,
  type CaseSnapshot,
  type Commitment,
  type DecisionOutcome,
  type DecisionRecord,
  type Evidence,
  type EvidenceKind,
  type Memo,
  type PortfolioInfo,
  type Scenario,
  type ScenarioOption,
  type TrainingSession,
} from "./types";

/** Stated on every export, so simulated work is never mistaken for real administrative experience. */
export const PORTFOLIO_NOTICE =
  "Produced in WPA Desk, a training simulation for writing program administrators. The institution, " +
  "people, scenarios, and outcomes are fictional. The decisions, memos, and reflections are the author's own.";

export const REFLECTION_PROMPT =
  "What would you do differently, and what did you learn about the people involved and what moves them?";

/** Everything about one decision, gathered for display or export. */
export interface CaseFile {
  index: number;
  decision: DecisionRecord;
  scenario: Scenario;
  option: ScenarioOption;
  memo: Memo | null;
  evidence: Evidence[];
  commitments: Commitment[];
  /** Absent for decisions made before snapshots existed. */
  snapshot: CaseSnapshot | null;
}

/** How the UI names people; the training layer doesn't know the cast. */
export interface Names {
  short: (id: StakeholderId) => string;
  byline: (id: StakeholderId) => string;
}

export function caseFiles(session: TrainingSession, scenarios: Scenario[]): CaseFile[] {
  return session.decisions.flatMap((decision, i) => {
    const scenario = scenarios.find((s) => s.id === decision.scenarioId);
    const option = scenario?.options.find((o) => o.id === decision.optionId);
    if (!scenario || !option) return [];
    const memo = session.dossier.find((m) => m.id === decision.memoId) ?? null;
    return [
      {
        index: i + 1,
        decision,
        scenario,
        option,
        memo,
        evidence: memo ? session.evidence.filter((e) => memo.evidenceIds.includes(e.id)) : [],
        commitments: memo ? session.commitments.filter((c) => memo.commitmentIds.includes(c.id)) : [],
        snapshot: decision.snapshot ?? null,
      },
    ];
  });
}

/** Saves a reflection. With a timestamp, the version is also added to the reflection's history. */
export function addReflection(session: TrainingSession, scenarioId: string, text: string, at?: Date): TrainingSession {
  if (!session.decisions.some((d) => d.scenarioId === scenarioId)) throw new Error(`No decision for ${scenarioId}`);
  const reflection = text.trim();
  return {
    ...session,
    decisions: session.decisions.map((d) => {
      if (d.scenarioId !== scenarioId) return d;
      const history = d.reflectionHistory ?? [];
      const changed = (history[history.length - 1]?.text ?? d.reflection ?? "") !== reflection;
      return {
        ...d,
        reflection: reflection || undefined,
        reflectionHistory:
          at && changed ? [...history, { at: at.toISOString(), text: reflection, words: wordCount(reflection) }] : d.reflectionHistory,
      };
    }),
  };
}

export function setPortfolio(session: TrainingSession, info: PortfolioInfo): TrainingSession {
  return { ...session, portfolio: { author: info.author.trim(), course: info.course.trim() } };
}

/** Explains which rule decided persuasion: evidence, trust, or both. */
export function persuasionSummary(
  p: NonNullable<DecisionOutcome["persuasion"]>,
  persuaded: boolean,
  missing: EvidenceKind[],
  names: Names,
): string {
  const who = names.short(p.reader);
  const need = missing.map((k) => EVIDENCE_LABELS[k]).join(", ");
  if (p.hadEvidence && persuaded) {
    return `Your memo carried the evidence ${who} needed, and the relationship could bear it (trust ${p.trust}; ${p.needed} needed).`;
  }
  if (p.hadEvidence) {
    return `You attached the right evidence, but ${who} doesn't trust you enough yet to act on it (trust ${p.trust}; ${p.needed} needed).`;
  }
  if (persuaded) {
    return `No evidence attached, but ${who} trusts your judgment enough to take your word (trust ${p.trust}; ${p.needed} needed).`;
  }
  return `Your memo didn't include ${need}, and ${who} doesn't know you well enough to take your word for it (trust ${p.trust}; ${p.needed} needed without evidence).`;
}

export function commitmentStatus(c: Commitment): string {
  const due = `due ${termLabel(c.dueTerm)}`;
  if (c.status === "kept") return `kept${c.resolvedTerm ? ` (${termLabel(c.resolvedTerm)})` : ""}`;
  if (c.status === "missed") return `missed (${due})`;
  return `open, ${due}${c.extended ? ", extended once" : ""}`;
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

export function caseFilesToMarkdown(session: TrainingSession, scenarios: Scenario[], names: Names, exportedAt: Date): string {
  const files = caseFiles(session, scenarios);
  const p = session.portfolio;
  const out: string[] = [
    "# Administrative Case Files",
    "",
    ...(p?.author ? [`**Author:** ${p.author}  `] : []),
    ...(p?.course ? [`**Course:** ${p.course}  `] : []),
    `**Institution:** ${session.program.institution}${session.program.fictional ? " (fictional)" : ""}  `,
    `**Exported:** ${exportedAt.toISOString().slice(0, 10)}  `,
    `**Progress:** ${termLabel(session.termIndex)} · ${files.length} decision${files.length === 1 ? "" : "s"} · ${session.dossier.length} memo${session.dossier.length === 1 ? "" : "s"}`,
    "",
    `> ${PORTFOLIO_NOTICE}`,
    "",
  ];
  if (files.length === 0 && session.reports.length === 0) {
    out.push("_No decisions yet._");
    return out.join("\n");
  }

  out.push(
    "## Contents",
    "",
    ...files.map((f) => `${f.index}. ${f.scenario.title} (${termLabel(f.decision.termIndex)})`),
    ...session.reports.map((r) => `- Year ${r.year} annual report`),
    ...(session.ending ? ["- How the arc ended"] : []),
    "",
  );

  for (const f of files) {
    const snap = f.snapshot;
    out.push("---", "", `## ${f.index}. ${f.scenario.title}`, "", `_${termLabel(f.decision.termIndex)}_`, "");

    out.push("### What arrived", "");
    for (const d of snap?.documents ?? f.scenario.documents) {
      out.push(`**From:** ${names.byline(d.from)}  `, `**Re:** ${d.subject}`, "", quote(d.body), "");
    }

    out.push("### Your decision", "", `**${f.option.label}.** ${f.option.description}`, "");

    if (f.memo) {
      const m = f.memo;
      out.push(
        "### Your memo",
        "",
        `**To:** ${names.byline(m.audience)}  `,
        `**Subject:** ${m.subject}  `,
        `**The ask:** ${m.ask}`,
        "",
        m.body,
        "",
      );
      if (f.evidence.length) {
        out.push("**Evidence attached**", "");
        for (const e of f.evidence) out.push(`- ${e.label}`, ...e.summary.map((line) => `  - ${line}`));
        out.push("");
      }
      if (f.commitments.length) {
        out.push("**Commitments**", "", ...f.commitments.map((c) => `- ${c.text} — ${commitmentStatus(c)}`), "");
      }
      const checked = SELF_ASSESSMENT.filter((i) => m.selfAssessment[i.id]);
      if (checked.length) out.push("**Self-assessment**", "", ...checked.map((i) => `- ${i.label}`), "");

      const revision = latestRevision(m.history);
      if (revision) {
        out.push(
          "#### Portfolio revision",
          "",
          `_Revised ${stamp(revision.at)} after sending. The version above is what the reader received._`,
          ...(revision.note ? ["", `**Revision note:** ${revision.note}`] : []),
          "",
          `**Subject:** ${revision.subject}  `,
          `**The ask:** ${revision.ask}`,
          "",
          revision.body,
          "",
        );
      }
      out.push(...historyMarkdown(m.history ?? [], m.startedAt));
    }

    out.push("### What happened", "");
    if (snap) {
      out.push(snap.narrative, "");
      if (snap.reply) out.push(quote(snap.reply.body), `> — ${names.short(snap.reply.from)}`, "");
      if (snap.persuasion && f.decision.persuaded !== null) {
        out.push(`_${persuasionSummary(snap.persuasion, f.decision.persuaded, snap.missingEvidence, names)}_`, "");
      }
      if (snap.trustChanges.length) {
        out.push(
          "**Relationships**",
          "",
          ...snap.trustChanges.map((t) => `- ${names.short(t.stakeholder)}: ${t.before} → ${t.after} (${t.after > t.before ? "+" : ""}${t.after - t.before})`),
          "",
        );
      }
      if (snap.changeDescriptions.length) {
        out.push("**Program changes**", "", ...snap.changeDescriptions.map((d) => `- ${d}`), "");
      }
    } else {
      out.push("_Details weren't recorded for this decision (made in an earlier version of WPA Desk)._", "");
    }

    const db = f.scenario.debrief;
    out.push("### Debrief", "", "What experienced WPAs weigh:", "", ...db.weighs.map((w) => `- ${w}`), "");
    if (db.perspectives.length) {
      out.push("How it looked from other desks:", "", ...db.perspectives.map((v) => `- **${names.short(v.stakeholder)}:** “${v.view}”`), "");
    }
    if (db.readings.length) out.push("Further reading:", "", ...db.readings.map((r) => `- ${r}`), "");

    out.push("### Reflection", "", f.decision.reflection ?? "_No reflection written._", "");
    const rh = f.decision.reflectionHistory ?? [];
    if (rh.length > 1) {
      out.push("#### Reflection history", "");
      rh.forEach((v, i) => {
        out.push(`**Version ${i + 1}** (${stamp(v.at)}, ${v.words} words)`, "");
        out.push(i === 0 ? v.text : diffToMarkdown(wordDiff(rh[i - 1]!.text, v.text)), "");
      });
    }
  }
  out.push(...reportsMarkdown(session, names));
  return out.join("\n");
}

const STAFFING_TEXT = { hire: "hired adjuncts", teach: "taught a section yourself", cancel: "cancelled the sections" } as const;

/** Staffing decisions, then annual reports, then the ending if the arc is over. */
function reportsMarkdown(session: TrainingSession, names: Names): string[] {
  const out: string[] = [];
  if (session.staffingLog.length) {
    out.push(
      "---",
      "",
      "## Staffing decisions",
      "",
      ...session.staffingLog.map(
        (d) => `- ${termLabel(d.termIndex)}: ${d.sections} section${d.sections === 1 ? "" : "s"} without an instructor; ${STAFFING_TEXT[d.choice]}.`,
      ),
      "",
    );
  }
  const you = session.portfolio?.author?.trim() || "The author";
  for (const r of session.reports) {
    out.push(
      "---",
      "",
      `## Year ${r.year} annual report`,
      "",
      `**To:** ${names.byline(r.to)}  `,
      `**From:** ${r.from === "player" ? you : names.byline(r.from)}  `,
      `_Submitted ${termLabel(r.termIndex)}._`,
      "",
    );
    for (const sec of r.sections) {
      const by = sec.author === "player" ? (r.from === "player" ? "" : " (the author's section)") : ` (${names.short(sec.author)})`;
      out.push(`### ${sec.title}${by}`, "", sec.body, "");
      if (sec.history) out.push(...historyMarkdown(sec.history, r.startedAt));
    }
    out.push("### Appendix: the numbers", "", ...r.appendix.map((l) => `- ${l}`), "");
    if (r.reply) out.push(quote(r.reply.body), `> — ${names.short(r.reply.from)}`, "");
  }
  const e = session.ending;
  if (e) {
    out.push(
      "---",
      "",
      "## How the arc ended",
      "",
      `**${e.title}**`,
      "",
      e.narrative,
      "",
      `Score: ${e.score} of 100 (university tenure-track needed ${e.thresholds.tenureTrackAt} and a dissertation on track; two-year college needed ${e.thresholds.twoYearAt}).`,
      "",
      ...(e.gateNote ? [`_${e.gateNote}_`, ""] : []),
      "| Factor | Points | Why |",
      "|---|---|---|",
      ...e.factors.map((f) => `| ${f.label} | ${f.points} / ${f.max} | ${f.explanation.replace(/\|/g, "\\|")} |`),
      "",
    );
  }
  return out;
}

/** Timeline plus word-level changes between consecutive versions. */
function historyMarkdown(history: DraftVersion[], startedAt: string | undefined): string[] {
  if (history.length === 0) {
    return ["#### Drafting history", "", "_No drafting history recorded (written before WPA Desk kept history)._", ""];
  }
  const minutes = draftingMinutes(startedAt, history);
  const out = [
    "#### Drafting history",
    "",
    `${history.length} version${history.length === 1 ? "" : "s"}${minutes !== null ? `; ${minutes} minute${minutes === 1 ? "" : "s"} from opening the memo to sending it` : ""}.`,
    "",
    "| # | Time (UTC) | Event | Words | Note |",
    "|---|---|---|---|---|",
    ...history.map((v, i) => {
      const delta = i === 0 ? "" : ` (${signedWords(v.words - history[i - 1]!.words)})`;
      return `| ${i + 1} | ${stamp(v.at)} | ${DRAFT_REASON_LABELS[v.reason]} | ${v.words}${delta} | ${(v.note ?? "").replace(/\|/g, "\\|")} |`;
    }),
    "",
  ];
  if (history.length > 1) {
    out.push("**Changes between versions** (~~removed~~, **added**)", "");
    history.slice(1).forEach((v, k) => {
      const prev = history[k]!;
      out.push(`_Version ${k + 2}: ${DRAFT_REASON_LABELS[v.reason]}_`, "");
      if (prev.subject !== v.subject) out.push(`Subject: ${diffToMarkdown(wordDiff(prev.subject, v.subject))}`, "");
      if (prev.ask !== v.ask) out.push(`Ask: ${diffToMarkdown(wordDiff(prev.ask, v.ask))}`, "");
      out.push(prev.body === v.body ? "_Body unchanged._" : diffToMarkdown(wordDiff(prev.body, v.body)), "");
    });
  }
  return out;
}

function stamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

function signedWords(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0";
}

function quote(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `> ${line}` : ">"))
    .join("\n");
}
