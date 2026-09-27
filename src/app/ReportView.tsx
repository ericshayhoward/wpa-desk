import type { Program } from "../model";
import { termLabel, type AnnualReport } from "../training";
import { DraftHistory } from "./HistoryView";
import { stakeholderByline, stakeholderName } from "./format";

interface Props {
  report: AnnualReport;
  program: Program;
  /** The player's name for the byline, if they gave one. */
  author?: string;
  /** Show drafting history under the player's sections. */
  showHistory?: boolean;
}

/** An assembled annual report, as filed. */
export function ReportView({ report, program, author, showHistory = false }: Props) {
  const you = author?.trim() || "You";
  const byline = (who: AnnualReport["from"]) => (who === "player" ? you : stakeholderByline(program, who));
  return (
    <article className="report document" aria-label={`Year ${report.year} annual report`}>
      <header>
        <div>
          <span className="muted small">To</span> {stakeholderByline(program, report.to)}
        </div>
        <div>
          <span className="muted small">From</span> {byline(report.from)}
        </div>
        <div>
          <span className="muted small">Re</span> First-Year Writing Annual Report, Year {report.year}
        </div>
      </header>
      {report.sections.map((s) => (
        <section key={s.id} className="report-section">
          <h4>
            {s.title}{" "}
            <span className="muted small">
              {s.author !== "player" ? `· ${stakeholderName(program, s.author)}` : report.from !== "player" ? "· your section" : ""}
            </span>
          </h4>
          {s.body.split(/\n\s*\n/).map((p, i) => (
            <p key={i} className="prewrap">
              {p}
            </p>
          ))}
          {showHistory && s.history && (
            <details className="why">
              <summary>Drafting history: {s.title}</summary>
              <DraftHistory history={s.history} startedAt={report.startedAt} />
            </details>
          )}
        </section>
      ))}
      <details className="why print-open">
        <summary>Appendix: the numbers</summary>
        <ul className="small">
          {report.appendix.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
      <p className="muted small">Submitted {termLabel(report.termIndex)}.</p>
    </article>
  );
}
