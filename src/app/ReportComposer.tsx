import { useEffect, useRef, useState } from "react";
import type { StakeholderId } from "../model";
import {
  HISTORY_NOTICE,
  REPORT_SECTIONS,
  SNAPSHOT_RULES,
  generatedSection,
  reportFacts,
  snapshot,
  wordCount,
  type DraftReason,
  type DraftVersion,
  type ReportInProgress,
  type ReportSectionId,
  type Scenario,
  type TrainingSession,
  type YearEndSpec,
} from "../training";
import { stakeholderByline, stakeholderName } from "./format";
import { Icon } from "./ui";

interface Props {
  session: TrainingSession;
  spec: YearEndSpec;
  scenarios: Scenario[];
  onDraft: (draft: ReportInProgress) => void;
  onSubmit: () => void;
  onBack: () => void;
}

type Sections = ReportInProgress["sections"];

/** Writing the player's sections of a year-end report, with the supervisor's sections shown in place. */
export function ReportComposer({ session, spec, scenarios, onDraft, onSubmit, onBack }: Props) {
  const resume = session.reportDraft?.termIndex === spec.term ? session.reportDraft : undefined;
  const [startedAt] = useState(() => resume?.startedAt ?? new Date().toISOString());
  const [sections, setSections] = useState<Sections>(
    () => resume?.sections ?? Object.fromEntries(spec.playerSections.map((id) => [id, { body: "", history: [] }])),
  );
  const facts = reportFacts(session, spec, scenarios);
  const program = session.program;

  const update = (id: ReportSectionId, body: string, reason?: DraftReason) =>
    setSections((all) => {
      const cur = all[id] ?? { body: "", history: [] };
      const history: DraftVersion[] = reason
        ? snapshot(cur.history, { subject: REPORT_SECTIONS[id].title, ask: "", body }, reason, new Date())
        : cur.history;
      return { ...all, [id]: { body, history } };
    });

  const change = (id: ReportSectionId, next: string) => {
    const before = sections[id]?.body ?? "";
    update(id, next, wordCount(next) - wordCount(before) >= SNAPSHOT_RULES.largeChangeWords ? "large-change" : undefined);
  };

  // Snapshot every section after a pause in writing.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const id of spec.playerSections) update(id, sections[id]?.body ?? "", "pause");
    }, SNAPSHOT_RULES.pauseMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  useEffect(() => {
    onDraftRef.current({ termIndex: spec.term, startedAt, sections });
  }, [spec.term, startedAt, sections]);

  const ready = spec.playerSections.every((id) => wordCount(sections[id]?.body ?? "") > 0);
  const hours = session.adminHoursRemaining;
  const request = spec.request;

  return (
    <div className="report-composer">
      <button className="link back-link" onClick={onBack}>
        <Icon name="back" size={16} />
        Back to desk
      </button>
      <h2 className="scenario-title">Year-end report</h2>

      <div className="document">
        <header>
          <div>
            <span className="muted small">From</span> {stakeholderByline(program, request.from)}
          </div>
          <div>
            <span className="muted small">Re</span> {request.subject}
          </div>
        </header>
        {request.body.split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <section className="card">
        <h3>The numbers</h3>
        <p className="muted small">From your program's records. Quote what helps; explain what it means.</p>
        <ul className="small">
          {facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </section>

      <section className="card memo">
        <h3>
          Annual report to {stakeholderByline(program, spec.to)}
          {spec.from !== "player" && <span className="muted small"> · from {stakeholderName(program, spec.from)}</span>}
        </h3>
        <p className="muted small">
          Reports are for reflection and your portfolio; they aren't scored. {HISTORY_NOTICE}
        </p>

        {spec.sections.map((id) => {
          const meta = REPORT_SECTIONS[id];
          if (!spec.playerSections.includes(id)) {
            return (
              <div key={id} className="report-section">
                <h4>
                  {meta.title} <span className="muted small">· {stakeholderName(program, spec.from as StakeholderId)} writes this section</span>
                </h4>
                <p className="muted prewrap">{generatedSection(id, session, spec, scenarios)}</p>
              </div>
            );
          }
          const body = sections[id]?.body ?? "";
          return (
            <label key={id} className="field report-section">
              <span>
                <strong>{meta.title}</strong> <span className="muted small">({wordCount(body)} words)</span>
              </span>
              <span className="muted small">{meta.prompt}</span>
              <textarea rows={8} value={body} aria-label={meta.title} onChange={(e) => change(id, e.target.value)} />
              <button
                className="link small"
                type="button"
                onClick={() => update(id, `${body.trimEnd()}${body.trim() ? "\n\n" : ""}${facts.join("\n")}`, "quoted-evidence")}
              >
                Quote the numbers
              </button>
            </label>
          );
        })}

        <div className="row-end">
          <button
            className="secondary"
            onClick={() => {
              for (const id of spec.playerSections) update(id, sections[id]?.body ?? "", "draft");
            }}
          >
            Save draft
          </button>
          <button className="primary" disabled={!ready} onClick={onSubmit}>
            {spec.capstone ? "Submit the report and finish the arc" : "Submit the report"}
          </button>
        </div>
        <p className="muted small row-end-note">
          {!ready
            ? "Write every section that's yours to submit."
            : `Takes ${spec.hours} admin hours${spec.hours > hours ? `; you have ${hours}, so the rest comes out of dissertation time` : ""}.`}
        </p>
      </section>
    </div>
  );
}
