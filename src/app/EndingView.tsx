import type { Program } from "../model";
import { DISSERTATION_LABELS, type AnnualReport, type EndingResult } from "../training";
import { ReportView } from "./ReportView";
import { CardTitle, Prose } from "./ui";
import type { CSSProperties } from "react";

interface Props {
  ending: EndingResult;
  report: AnnualReport | undefined;
  program: Program;
  author?: string;
  onDossier?: () => void;
  onNewSession?: () => void;
}

/** How the arc ended, why, and the capstone report beside it. */
export function EndingView({ ending, report, program, author, onDossier, onNewSession }: Props) {
  const { tenureTrackAt, twoYearAt } = ending.thresholds;
  return (
    <div className="ending">
      <header className="ending-hero">
        <div>
          <p className="muted small">The end of the arc</p>
          <h2>{ending.title}</h2>
        </div>
        <div className="score-ring" style={{ "--p": ending.score } as CSSProperties} aria-hidden="true">
          <div>
            <strong>{ending.score}</strong>
            <span>of 100</span>
          </div>
        </div>
      </header>
      <section className="card narrative">
        <Prose text={ending.narrative} />
      </section>

      {ending.workOn && ending.workOn.length > 0 && (
        <section className="card feedback work-on" aria-labelledby="work-on">
          <CardTitle icon="flag" level={3} id="work-on">
            What you need to work on
          </CardTitle>
          {ending.gateNote && <p className="banner bad">{ending.gateNote}</p>}
          {ending.workOn.map((f) => (
            <div key={f.factorId} className="feedback-item">
              <h4>{f.heading}</h4>
              <p>{f.text}</p>
            </div>
          ))}
        </section>
      )}

      {ending.didWell && ending.didWell.length > 0 && (
        <section className="card feedback did-well" aria-labelledby="did-well">
          <CardTitle icon="sparkle" level={3} id="did-well">
            What you did well
          </CardTitle>
          {ending.didWell.map((f) => (
            <div key={f.factorId} className="feedback-item">
              <h4>{f.heading}</h4>
              <p>{f.text}</p>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <CardTitle icon="book" level={3}>
          Why this ending
        </CardTitle>
        <p>
          Your record scored <strong>{ending.score}</strong> of 100. A university tenure-track job needed {tenureTrackAt} and a
          dissertation finished or on track; a two-year college position needed {twoYearAt}.
        </p>
        {ending.gateNote && !ending.workOn?.length && <p className="banner bad">{ending.gateNote}</p>}
        <div className="table-scroll">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">Factor</th>
                <th scope="col">Points</th>
                <th scope="col">Why</th>
              </tr>
            </thead>
            <tbody>
              {ending.factors.map((f) => (
                <tr key={f.id}>
                  <th scope="row">{f.label}</th>
                  <td className="num">
                    {f.points} / {f.max}
                  </td>
                  <td className="small">{f.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Dissertation: {DISSERTATION_LABELS[ending.dissertation.status]}. No single path leads to a good ending; the factors
          are what search committees and supervisors tend to weigh.
        </p>
      </section>

      {report && (
        <section>
          <h3>Your Year {report.year} annual report</h3>
          <ReportView report={report} program={program} author={author} />
        </section>
      )}

      {(onDossier || onNewSession) && (
        <div className="row-end no-print">
          {onDossier && (
            <button className="secondary" onClick={onDossier}>
              Open your case files
            </button>
          )}
          {onNewSession && (
            <button className="secondary" onClick={onNewSession}>
              Start a new session
            </button>
          )}
        </div>
      )}
    </div>
  );
}
