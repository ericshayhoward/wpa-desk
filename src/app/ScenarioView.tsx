import { useState } from "react";
import {
  fillTemplate,
  type DraftInProgress,
  termOf,
  unavailableReason,
  type EvidenceDraft,
  type MemoDraft,
  type Scenario,
  type ScenarioOption,
  type TrainingSession,
} from "../training";
import { CapCalculator } from "./CapCalculator";
import { MemoComposer } from "./MemoComposer";
import { StaffingPlanner } from "./StaffingPlanner";
import { stakeholderByline } from "./format";
import { CardTitle, Icon, Prose } from "./ui";

const GENRE_LABELS = { memo: "Memo", email: "Email", report: "Report", note: "Note" } as const;

interface Props {
  scenario: Scenario;
  session: TrainingSession;
  onSaveEvidence: (draft: EvidenceDraft) => void;
  onDecide: (optionId: string, memo: MemoDraft | null) => void;
  onDraft: (draft: DraftInProgress) => void;
  onBack: () => void;
}

export function ScenarioView({ scenario, session, onSaveEvidence, onDecide, onDraft, onBack }: Props) {
  const program = session.program;
  // Resume an unsent memo where the writer left off.
  const resume = session.drafts?.[scenario.id];
  const [chosen, setChosen] = useState<ScenarioOption | null>(
    () => scenario.options.find((o) => o.id === resume?.optionId) ?? null,
  );
  const [writing, setWriting] = useState(Boolean(resume && chosen?.memo));

  const choose = (option: ScenarioOption) => {
    setChosen(option);
    setWriting(Boolean(option.memo?.required));
  };

  return (
    <div className="scenario">
      <button className="link back-link" onClick={onBack}>
        <Icon name="back" size={16} />
        Back to desk
      </button>
      <p className="scenario-kicker">
        {scenario.urgent && <span className="badge urgent">urgent</span>}
        {scenario.documents.length} document{scenario.documents.length === 1 ? "" : "s"} on your desk
      </p>
      <h2 className="scenario-title">{scenario.title}</h2>

      {scenario.documents.map((d, i) => (
        <article key={i} className={`document ${d.genre}`}>
          <span className="doc-genre" aria-hidden="true">
            {GENRE_LABELS[d.genre]}
          </span>
          <header>
            <div>
              <span className="muted small">From</span> {stakeholderByline(program, d.from)}
            </div>
            <div>
              <span className="muted small">Re</span> {fillTemplate(d.subject, session)}
            </div>
          </header>
          <Prose text={fillTemplate(d.body, session)} />
        </article>
      ))}

      {scenario.suggestedTools.includes("cap_calculator") && (
        <details className="tool-drawer">
          <summary>
            Open the class cap calculator
            <span className="muted small"> — try the proposal, then save the comparison as evidence</span>
          </summary>
          <CapCalculator program={program} onSaveEvidence={onSaveEvidence} />
        </details>
      )}

      {scenario.suggestedTools.includes("staffing_planner") && (
        <details className="tool-drawer">
          <summary>
            Open the staffing planner
            <span className="muted small"> — check a term's staffing and budget, try a plan, then save it as evidence</span>
          </summary>
          <StaffingPlanner program={program} onSaveEvidence={onSaveEvidence} initialTerm={termOf(session.termIndex)} />
        </details>
      )}

      {!writing && (
        <section className="card">
          <CardTitle icon="pen" level={3}>
            How do you respond?
          </CardTitle>
          <ul className="options">
            {scenario.options.map((o, i) => {
              const blocked = unavailableReason(session, o);
              return (
                <li key={o.id}>
                  <button
                    className={`option ${chosen?.id === o.id ? "selected" : ""}`}
                    disabled={Boolean(blocked)}
                    aria-pressed={chosen?.id === o.id}
                    onClick={() => choose(o)}
                  >
                    <span className="option-key" aria-hidden="true">
                      {chosen?.id === o.id ? <Icon name="check" size={16} /> : String.fromCharCode(65 + i)}
                    </span>
                    <strong>{o.label}</strong>
                    <span>{o.description}</span>
                    <span className="costs small">
                      <span className="cost-chip">
                        <Icon name="clock" size={12} /> {o.cost.adminHours} admin hr
                      </span>
                      {o.cost.politicalCapital > 0 && (
                        <span className="cost-chip capital">
                          <Icon name="capital" size={12} /> {o.cost.politicalCapital} political capital
                        </span>
                      )}
                      {o.memo?.required && (
                        <span className="cost-chip memo">
                          <Icon name="pen" size={12} /> memo required
                        </span>
                      )}
                    </span>
                    {blocked && <span className="down small">{blocked}</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          {chosen && !chosen.memo?.required && (
            <div className="row-end">
              {chosen.memo && (
                <button className="secondary" onClick={() => setWriting(true)}>
                  Write a memo first
                </button>
              )}
              <button className="primary" onClick={() => onDecide(chosen.id, null)}>
                Decide without a memo
              </button>
            </div>
          )}
        </section>
      )}

      {writing && chosen?.memo && (
        <MemoComposer
          session={session}
          option={chosen}
          audience={chosen.memo.audience}
          prompt={chosen.memo.prompt}
          defaultSubject={`Re: ${fillTemplate(scenario.documents[0]?.subject ?? scenario.title, session)}`}
          resume={resume}
          onDraft={onDraft}
          onCancel={() => setWriting(false)}
          onSend={(memo) => onDecide(chosen.id, memo)}
        />
      )}
    </div>
  );
}
