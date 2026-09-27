import type { Scenario, TrainingSession } from "./types";
import { SELF_ASSESSMENT } from "./types";
import { termLabel } from "./terms";

/** Renders the session's dossier as a Markdown portfolio of administrative writing. */
export function dossierToMarkdown(session: TrainingSession, scenarios: Scenario[]): string {
  const name = (id: string) => session.program.stakeholders.find((s) => s.id === id)?.name ?? id;
  const lines: string[] = [
    `# Administrative Dossier`,
    ``,
    `${session.program.institution}${session.program.fictional ? " (fictional training program)" : ""}`,
    ``,
  ];
  if (session.dossier.length === 0) {
    lines.push("_No memos filed yet._");
    return lines.join("\n");
  }

  for (const memo of session.dossier) {
    const scenario = scenarios.find((s) => s.id === memo.scenarioId);
    const option = scenario?.options.find((o) => o.id === memo.optionId);
    lines.push(
      `---`,
      ``,
      `## ${memo.subject}`,
      ``,
      `**To:** ${name(memo.audience)}  `,
      `**Term:** ${termLabel(memo.termIndex)}  `,
      `**Context:** ${scenario?.title ?? memo.scenarioId}${option ? ` — decision: ${option.label}` : ""}`,
      ``,
      `**The ask:** ${memo.ask}`,
      ``,
      memo.body,
      ``,
    );

    const evidence = session.evidence.filter((e) => memo.evidenceIds.includes(e.id));
    if (evidence.length) {
      lines.push(`### Evidence attached`, ``);
      for (const e of evidence) {
        lines.push(`**${e.label}**`, ``, ...e.summary.map((s) => `- ${s}`), ``);
      }
    }

    const commitments = session.commitments.filter((c) => memo.commitmentIds.includes(c.id));
    if (commitments.length) {
      lines.push(`### Commitments`, ``);
      for (const c of commitments) lines.push(`- ${c.text} (due ${termLabel(c.dueTerm)}; ${c.status})`);
      lines.push(``);
    }

    const checked = SELF_ASSESSMENT.filter((item) => memo.selfAssessment[item.id]);
    if (checked.length) {
      lines.push(`### Self-assessment`, ``, ...checked.map((i) => `- ${i.label}`), ``);
    }
  }
  return lines.join("\n");
}
