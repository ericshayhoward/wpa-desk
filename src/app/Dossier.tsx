import { useState } from "react";
import {
  PORTFOLIO_NOTICE,
  SELF_ASSESSMENT,
  caseFiles,
  caseFilesToMarkdown,
  commitmentStatus,
  latestRevision,
  persuasionSummary,
  termLabel,
  type PortfolioInfo,
  type Scenario,
  type TrainingSession,
} from "../training";
import { namesFor } from "./format";
import { DraftHistory, ReflectionHistory, RevisionEditor } from "./HistoryView";
import { ReflectionEditor } from "./ReflectionEditor";

interface Props {
  session: TrainingSession;
  scenarios: Scenario[];
  /** Editing handlers. Omit them all for a read-only view (instructor review). */
  onReflect?: (scenarioId: string, text: string) => void;
  onRevise?: (memoId: string, content: { subject: string; ask: string; body: string }, note: string) => void;
  onPortfolio?: (info: PortfolioInfo) => void;
  /** Heading shown above the case files; defaults to "Dossier". */
  title?: string;
}

/** Case files: one self-contained record per decision, printable and exportable. */
export function Dossier({ session, scenarios, onReflect, onRevise, onPortfolio, title = "Dossier" }: Props) {
  const readOnly = !onReflect && !onRevise && !onPortfolio;
  const files = caseFiles(session, scenarios);
  const names = namesFor(session.program);
  const [author, setAuthor] = useState(session.portfolio?.author ?? "");
  const [course, setCourse] = useState(session.portfolio?.course ?? "");
  const infoDirty = author.trim() !== (session.portfolio?.author ?? "") || course.trim() !== (session.portfolio?.course ?? "");

  const exportMarkdown = () => {
    const text = caseFilesToMarkdown(session, scenarios, names, new Date());
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `wpa-case-files${author.trim() ? `-${author.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="dossier">
      <div className="tool-head no-print">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            {readOnly
              ? "Read-only. One case file per decision, with drafting history and reflections."
              : "One case file per decision: what arrived, what you decided and wrote, what happened, the debrief, and your reflection. Print it or export it as a portfolio of administrative writing."}
          </p>
        </div>
        <div className="row-start">
          <button className="secondary" disabled={files.length === 0} onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <button className="secondary" disabled={files.length === 0} onClick={exportMarkdown}>
            Export as Markdown
          </button>
        </div>
      </div>

      {onPortfolio && (
      <div className="card no-print portfolio-form">
        <h3>Cover page</h3>
        <div className="grid-2">
          <label className="field">
            <span>Your name</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          <label className="field">
            <span>Course or program</span>
            <input value={course} placeholder="e.g., ENGL 790: Writing Program Administration" onChange={(e) => setCourse(e.target.value)} />
          </label>
        </div>
        <button className="secondary" disabled={!infoDirty} onClick={() => onPortfolio({ author, course })}>
          Save cover details
        </button>
      </div>
      )}

      <header className="cover">
        <h2>Administrative Case Files</h2>
        {session.portfolio?.author && <p>{session.portfolio.author}</p>}
        {session.portfolio?.course && <p>{session.portfolio.course}</p>}
        <p className="muted small">
          {session.program.institution}
          {session.program.fictional ? " (fictional)" : ""} · {termLabel(session.termIndex)} · {files.length} decision
          {files.length === 1 ? "" : "s"} · {session.dossier.length} memo{session.dossier.length === 1 ? "" : "s"}
        </p>
        <p className="notice small">{PORTFOLIO_NOTICE}</p>
      </header>

      {files.length === 0 && <p className="muted">No decisions yet. Case files appear here as you resolve scenarios.</p>}

      {files.map((f) => {
        const snap = f.snapshot;
        const m = f.memo;
        const checked = m ? SELF_ASSESSMENT.filter((i) => m.selfAssessment[i.id]) : [];
        return (
          <article key={f.decision.scenarioId} className="case-file" aria-labelledby={`case-${f.index}`}>
            <h2 id={`case-${f.index}`}>
              {f.index}. {f.scenario.title}
            </h2>
            <p className="muted small">{termLabel(f.decision.termIndex)}</p>

            <h3>What arrived</h3>
            {(snap?.documents ?? f.scenario.documents).map((d, i) => (
              <div key={i} className="document">
                <header>
                  <div>
                    <span className="muted small">From</span> {names.byline(d.from)}
                  </div>
                  <div>
                    <span className="muted small">Re</span> {d.subject}
                  </div>
                </header>
                {d.body.split(/\n\s*\n/).map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            ))}

            <h3>Your decision</h3>
            <p>
              <strong>{f.option.label}.</strong> {f.option.description}
            </p>

            {m && (
              <>
                <h3>Your memo</h3>
                <div className="document memo filed">
                  <header>
                    <div>
                      <span className="muted small">To</span> {names.byline(m.audience)}
                    </div>
                    <div>
                      <span className="muted small">Re</span> {m.subject}
                    </div>
                  </header>
                  <p>
                    <strong>The ask:</strong> {m.ask}
                  </p>
                  {m.body.split(/\n\s*\n/).map((p, i) => (
                    <p key={i} className="prewrap">
                      {p}
                    </p>
                  ))}
                </div>
                {f.evidence.length > 0 && (
                  <div className="small">
                    <strong>Evidence attached</strong>
                    <ul>
                      {f.evidence.map((e) => (
                        <li key={e.id}>{e.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {f.commitments.length > 0 && (
                  <div className="small">
                    <strong>Commitments</strong>
                    <ul>
                      {f.commitments.map((c) => (
                        <li key={c.id}>
                          {c.text} — {commitmentStatus(c)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {checked.length > 0 && <p className="small muted">Self-assessment: {checked.map((c) => c.label).join(" · ")}</p>}

                {(() => {
                  const rev = latestRevision(m.history);
                  return (
                    <>
                      {rev && (
                        <>
                          <h4>Portfolio revision</h4>
                          <p className="muted small">
                            Revised after sending. The version above is what {names.short(m.audience)} received.
                            {rev.note && (
                              <>
                                {" "}
                                <strong>Revision note:</strong> {rev.note}
                              </>
                            )}
                          </p>
                          <div className="document memo filed">
                            <header>
                              <div>
                                <span className="muted small">Re</span> {rev.subject}
                              </div>
                            </header>
                            <p>
                              <strong>The ask:</strong> {rev.ask}
                            </p>
                            {rev.body.split(/\n\s*\n/).map((p, i) => (
                              <p key={i} className="prewrap">
                                {p}
                              </p>
                            ))}
                          </div>
                        </>
                      )}
                      {onRevise && (
                        <RevisionEditor
                          key={(m.history ?? []).length}
                          initial={rev ?? { subject: m.subject, ask: m.ask, body: m.body }}
                          onSave={(content, note) => onRevise(m.id, content, note)}
                        />
                      )}
                      <h4>Drafting history</h4>
                      <DraftHistory history={m.history ?? []} startedAt={m.startedAt} />
                    </>
                  );
                })()}
              </>
            )}

            <h3>What happened</h3>
            {snap ? (
              <>
                {snap.narrative.split(/\n\s*\n/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {snap.reply && (
                  <blockquote className="reply">
                    <p>{snap.reply.body}</p>
                    <footer>— {names.short(snap.reply.from)}</footer>
                  </blockquote>
                )}
                {snap.persuasion && f.decision.persuaded !== null && (
                  <p className="small">
                    <em>{persuasionSummary(snap.persuasion, f.decision.persuaded, snap.missingEvidence, names)}</em>
                  </p>
                )}
                {(snap.trustChanges.length > 0 || snap.changeDescriptions.length > 0) && (
                  <ul className="small">
                    {snap.trustChanges.map((t) => (
                      <li key={t.stakeholder}>
                        {names.short(t.stakeholder)}: trust {t.before} → {t.after}
                      </li>
                    ))}
                    {snap.changeDescriptions.map((d, i) => (
                      <li key={`c${i}`}>{d}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="muted small">Details weren't recorded for this decision (made in an earlier version of WPA Desk).</p>
            )}

            <details className="why print-open">
              <summary>Debrief</summary>
              <ul>
                {f.scenario.debrief.weighs.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>

            <h3>Reflection</h3>
            {onReflect ? (
              <ReflectionEditor
                key={`${f.decision.scenarioId}-${f.decision.reflection ?? ""}`}
                scenarioTitle={f.scenario.title}
                saved={f.decision.reflection}
                onSave={(text) => onReflect(f.decision.scenarioId, text)}
              />
            ) : (
              <p className={`prewrap ${f.decision.reflection ? "" : "muted"}`}>{f.decision.reflection ?? "No reflection written."}</p>
            )}
            <ReflectionHistory history={f.decision.reflectionHistory ?? []} />
          </article>
        );
      })}
    </section>
  );
}
