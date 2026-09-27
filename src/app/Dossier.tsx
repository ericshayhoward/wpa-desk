import { SELF_ASSESSMENT, dossierToMarkdown, termLabel, type Scenario, type TrainingSession } from "../training";
import { stakeholderName } from "./format";

interface Props {
  session: TrainingSession;
  scenarios: Scenario[];
}

export function Dossier({ session, scenarios }: Props) {
  const program = session.program;

  const exportMarkdown = () => {
    const blob = new Blob([dossierToMarkdown(session, scenarios)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wpa-dossier-${program.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="dossier">
      <div className="tool-head">
        <div>
          <h2>Dossier</h2>
          <p className="muted">Every memo you send is filed here: a record of your administration, and a portfolio of administrative writing.</p>
        </div>
        <button className="secondary" disabled={session.dossier.length === 0} onClick={exportMarkdown}>
          Export as Markdown
        </button>
      </div>

      {session.dossier.length === 0 && <p className="muted">No memos yet.</p>}

      {[...session.dossier].reverse().map((memo) => {
        const scenario = scenarios.find((s) => s.id === memo.scenarioId);
        const option = scenario?.options.find((o) => o.id === memo.optionId);
        const evidence = session.evidence.filter((e) => memo.evidenceIds.includes(e.id));
        const commitments = session.commitments.filter((c) => memo.commitmentIds.includes(c.id));
        const checked = SELF_ASSESSMENT.filter((i) => memo.selfAssessment[i.id]);
        return (
          <article key={memo.id} className="document memo filed">
            <header>
              <div>
                <span className="muted small">To</span> {stakeholderName(program, memo.audience)}
              </div>
              <div>
                <span className="muted small">Re</span> {memo.subject}
              </div>
              <div className="muted small">
                {termLabel(memo.termIndex)} · {scenario?.title}
                {option && ` · decision: ${option.label}`}
              </div>
            </header>
            <p>
              <strong>The ask:</strong> {memo.ask}
            </p>
            {memo.body.split(/\n\s*\n/).map((p, i) => (
              <p key={i} className="prewrap">
                {p}
              </p>
            ))}
            {evidence.length > 0 && (
              <div className="small">
                <strong>Evidence attached:</strong> {evidence.map((e) => e.label).join("; ")}
              </div>
            )}
            {commitments.length > 0 && (
              <div className="small">
                <strong>Commitments:</strong>{" "}
                {commitments.map((c) => `${c.text} (due ${termLabel(c.dueTerm)}, ${c.status})`).join("; ")}
              </div>
            )}
            {checked.length > 0 && (
              <div className="small muted">Self-assessment: {checked.map((c) => c.label).join(" · ")}</div>
            )}
          </article>
        );
      })}
    </section>
  );
}
