import { RANK_LABELS, type Program } from "../model";
import { EVIDENCE_LABELS, type DecisionOutcome } from "../training";
import { signed, stakeholderName, usd } from "./format";

interface Props {
  outcome: DecisionOutcome;
  program: Program;
  onDone: () => void;
  onDossier: () => void;
}

export function OutcomeView({ outcome, program, onDone, onDossier }: Props) {
  const { scenario, option, consequence, persuaded, missingEvidence, trustChanges, politicalCapital, impact, queued, memo } = outcome;
  const c = impact.comparison;
  const staffingChanges = Object.entries(c.sectionsByRank).filter(([, d]) => d !== 0);
  const programChanged = c.sections !== 0 || c.programCost !== 0 || c.budgetBalance !== 0;

  return (
    <div className="outcome">
      <p className="muted small">{scenario.title}</p>
      <h2>You chose: {option.label}</h2>

      {persuaded !== null && (
        <p className={`banner ${persuaded ? "good" : "bad"}`}>
          {persuaded
            ? "Your memo carried the evidence this reader needed."
            : `Your memo didn't include the kind of evidence this reader needed: ${missingEvidence
                .map((k) => EVIDENCE_LABELS[k])
                .join(", ")}.`}
        </p>
      )}

      <section className="card">
        {consequence.narrative.split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {consequence.response && (
          <blockquote className="reply">
            <p>{consequence.response.body}</p>
            <footer>— {stakeholderName(program, consequence.response.from)}</footer>
          </blockquote>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h3>Relationships</h3>
          {trustChanges.length === 0 ? (
            <p className="muted">No change in trust.</p>
          ) : (
            <ul className="changes">
              {trustChanges.map((t) => (
                <li key={t.stakeholder}>
                  <span>{stakeholderName(program, t.stakeholder)}</span>
                  <span className="num">
                    {t.before} → {t.after}{" "}
                    <span className={t.after > t.before ? "up" : "down"}>({signed(t.after - t.before)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="small">
            Political capital: {politicalCapital.before} → {politicalCapital.after}
          </p>
        </section>

        <section className="card">
          <h3>Projected effect on a fall term</h3>
          {!programChanged ? (
            <p className="muted">Sections, staffing, and budget are unchanged.</p>
          ) : (
            <ul className="changes">
              <li>
                <span>Sections</span>
                <span className="num">{signed(c.sections)}</span>
              </li>
              <li>
                <span>Budget balance</span>
                <span className={`num ${c.budgetBalance > 0 ? "up" : c.budgetBalance < 0 ? "down" : ""}`}>
                  {c.budgetBalance > 0 ? "+" : ""}
                  {usd(c.budgetBalance)}
                </span>
              </li>
              <li>
                <span>Projected D/F/W</span>
                <span className="num">{signed(c.dfwMid * 100, 1)} pts</span>
              </li>
              {staffingChanges.map(([rank, d]) => (
                <li key={rank}>
                  <span>{RANK_LABELS[rank as keyof typeof RANK_LABELS]} sections</span>
                  <span className={`num ${d! < 0 ? "down" : "up"}`}>{signed(d!)}</span>
                </li>
              ))}
            </ul>
          )}
          {queued.length > 0 && (
            <p className="small muted">
              This decision isn't finished with you. Something from it will come back in {queued[0]!.inTerms} term
              {queued[0]!.inTerms > 1 ? "s" : ""}.
            </p>
          )}
        </section>
      </div>

      <section className="card debrief">
        <h3>Debrief</h3>
        <p className="muted">There's no single right answer here. Experienced WPAs weigh:</p>
        <ul>
          {scenario.debrief.weighs.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>

        {scenario.debrief.perspectives.length > 0 && (
          <>
            <h4>How it looks from other desks</h4>
            <ul className="perspectives">
              {scenario.debrief.perspectives.map((p, i) => (
                <li key={i}>
                  <strong>{stakeholderName(program, p.stakeholder)}:</strong> “{p.view}”
                </li>
              ))}
            </ul>
          </>
        )}

        {scenario.debrief.readings.length > 0 && (
          <>
            <h4>Further reading</h4>
            <ul>
              {scenario.debrief.readings.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="row-end">
        {memo && (
          <button className="secondary" onClick={onDossier}>
            See your memo in the dossier
          </button>
        )}
        <button className="primary" onClick={onDone}>
          Back to desk
        </button>
      </div>
    </div>
  );
}
