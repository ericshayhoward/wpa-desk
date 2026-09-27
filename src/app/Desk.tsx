import { SCENARIOS } from "../content";
import {
  COMMITMENT_EFFECTS,
  STAFFING_EFFECTS,
  STAFFING_LABELS,
  blockingScenarios,
  describeProgramChanges,
  fillTemplate,
  isFinalTerm,
  termLabel,
  type Arc,
  type StaffingChoice,
  type YearEndSpec,
  type Commitment,
  type PendingEffect,
  type TrainingSession,
} from "../training";
import { CommitmentsCard } from "./CommitmentsCard";
import { PeopleCard } from "./PeopleCard";
import { stakeholderName } from "./format";
import { Avatar, CardTitle, Icon } from "./ui";

interface Props {
  session: TrainingSession;
  /** The arc being played, if any. */
  arc?: Arc;
  /** A year-end report due this term, if any. */
  reportDue?: YearEndSpec | null;
  onOpenReport?: () => void;
  /** Uncovered sections waiting on a staffing decision, if any. */
  staffingDue?: { unstaffed: number } | null;
  onStaffing?: (choice: StaffingChoice) => void;
  /** What happened when the term advanced: role changes, delayed effects, and missed commitments. */
  landed: { effects: PendingEffect[]; missed: Commitment[]; drift: string[]; milestones: string[] };
  onOpen: (scenarioId: string) => void;
  onNextTerm: () => void;
  onDeliver: (id: string) => void;
  onExtend: (id: string) => void;
  onAbandon: (id: string) => void;
}

export function Desk({ session, arc, reportDue, onOpenReport, staffingDue, onStaffing, landed, onOpen, onNextTerm, onDeliver, onExtend, onAbandon }: Props) {
  const program = session.program;
  const inbox = session.inbox.map((id) => SCENARIOS.find((s) => s.id === id)!).filter(Boolean);
  const titleOf = (id: string) => SCENARIOS.find((s) => s.id === id)?.title ?? (id === "staffing" ? "Staffing" : id);
  const blocking = blockingScenarios(session, SCENARIOS);
  const final = isFinalTerm(session, arc);
  // The capstone closes the arc, so urgent items have to be resolved first.
  const reportBlocked = !!staffingDue || (!!reportDue?.capstone && blocking.length > 0);

  return (
    <div className="desk">
      {(landed.effects.length > 0 || landed.missed.length > 0 || landed.drift.length > 0 || landed.milestones.length > 0) && (
        <section className="notice since" aria-live="polite">
          <h2>
            <Icon name="bulletin" size={18} /> Since last term
          </h2>
          {landed.milestones.map((m, i) => (
            <p key={`m${i}`}>
              <strong>{m}</strong>
            </p>
          ))}
          {landed.effects.map((p, i) => (
            <p key={i}>
              <span className="muted small">{titleOf(p.scenarioId)}:</span> {p.note}
            </p>
          ))}
          {landed.drift.map((d, i) => (
            <p key={`d${i}`}>
              <span className="muted small">Turnover:</span> {d}
            </p>
          ))}
          {landed.missed.map((c) => (
            <p key={c.id}>
              <span className="muted small">Missed commitment:</span> {c.text}{" "}
              <span className="down small">
                ({stakeholderName(program, c.audience)} trust {COMMITMENT_EFFECTS.missedTrust})
              </span>
            </p>
          ))}
        </section>
      )}

      {staffingDue && onStaffing && (
        <section className="card staffing" aria-labelledby="staffing-heading">
          <h2 id="staffing-heading" className="card-title">
            <span className="icon-chip alert-chip" aria-hidden="true">
              <Icon name="alert" size={16} />
            </span>
            {staffingDue.unstaffed} section{staffingDue.unstaffed === 1 ? "" : "s"} without an instructor
            <span className="badge urgent">due this term</span>
          </h2>
          <p className="muted small">
            Students are enrolled and the registrar needs names. Decide before the term ends.
          </p>
          <ul className="options">
            <li>
              <button className="option" onClick={() => onStaffing("hire")}>
                <strong>{STAFFING_LABELS.hire}</strong>
                <span>Post the sections and hire from the adjunct pool. New instructors, less experience.</span>
                <span className="costs small">
                  <span className="cost-chip">
                    <Icon name="clock" size={12} /> {STAFFING_EFFECTS.hireHours} admin hr
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button className="option" onClick={() => onStaffing("teach")}>
                <strong>{STAFFING_LABELS.teach}</strong>
                <span>
                  Take one section on top of your job{staffingDue.unstaffed > 1 ? " and hire for the rest" : ""}. Instructors notice.
                  Hours past what you have come out of dissertation time.
                </span>
                <span className="costs small">
                  <span className="cost-chip">
                    <Icon name="clock" size={12} /> {STAFFING_EFFECTS.teachHours} admin hr
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button className="option" onClick={() => onStaffing("cancel")}>
                <strong>{STAFFING_LABELS.cancel}</strong>
                <span>Students lose their seats this term. The sections come back next term.</span>
                <span className="costs small">
                  <span className="cost-chip">
                    <Icon name="clock" size={12} /> 0 admin hr
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </section>
      )}

      <section className="card">
        <CardTitle icon="mail">
          Inbox
          {inbox.length + (reportDue ? 1 : 0) > 0 && (
            <span className="count-pill" aria-label={`${inbox.length + (reportDue ? 1 : 0)} waiting`}>
              {inbox.length + (reportDue ? 1 : 0)}
            </span>
          )}
        </CardTitle>
        {reportDue && (
          <ul className="inbox">
            <li>
              <button className="inbox-item is-urgent" onClick={onOpenReport} disabled={reportBlocked}>
                <Avatar program={program} id={reportDue.request.from} size={42} />
                <span className="inbox-text">
                  <span className="inbox-from">
                    {stakeholderName(program, reportDue.request.from)}
                    <span className="badge urgent">due this term</span>
                  </span>
                  <span className="inbox-subject">{reportDue.request.subject}</span>
                  <span className="muted small">
                    Year-end report · {reportDue.hours} admin hours
                    {staffingDue
                      ? " · cover this term's sections first"
                      : reportBlocked
                        ? " · resolve the urgent items first"
                        : ""}
                  </span>
                </span>
                <span className="inbox-side">
                  <Icon name="arrow" className="inbox-go" />
                </span>
              </button>
            </li>
          </ul>
        )}
        {inbox.length === 0 ? (
          !reportDue && (
            <div className="inbox-empty">
              <span className="icon-chip" aria-hidden="true">
                <Icon name="check" size={22} />
              </span>
              <strong>Inbox zero.</strong>
              <p className="muted">Nothing waiting on you this term.</p>
            </div>
          )
        ) : (
          <ul className="inbox">
            {inbox.map((s) => {
              const doc = s.documents[0]!;
              return (
                <li key={s.id}>
                  <button className={`inbox-item ${s.urgent ? "is-urgent" : ""}`} onClick={() => onOpen(s.id)}>
                    <Avatar program={program} id={doc.from} size={42} />
                    <span className="inbox-text">
                      <span className="inbox-from">
                        {stakeholderName(program, doc.from)}
                        {s.urgent && <span className="badge urgent">urgent</span>}
                      </span>
                      <span className="inbox-subject">{fillTemplate(doc.subject, session)}</span>
                    </span>
                    <span className="inbox-side">
                      <span className="inbox-tag">{s.title}</span>
                      <Icon name="arrow" className="inbox-go" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {final ? (
          <p className="muted small row-end-note">
            {termLabel(session.termIndex)} is the final term of {arc!.title}.
            {reportDue ? " Submitting the annual report finishes the arc." : ""}
          </p>
        ) : (
          <div className="row-end">
            <button
              className={`advance ${inbox.length ? "secondary" : "primary"}`}
              disabled={blocking.length > 0 || !!reportDue || !!staffingDue}
              onClick={onNextTerm}
            >
              {inbox.length ? "Leave these for next term and advance" : `Advance to ${termLabel(session.termIndex + 1)}`}
              <Icon name="arrow" size={17} />
            </button>
          </div>
        )}
        {staffingDue && <p className="muted small row-end-note">Decide how to cover the sections without an instructor.</p>}
        {reportDue && !final && (
          <p className="muted small row-end-note">Submit the year-end report before the term ends.</p>
        )}
        {blocking.length > 0 && (
          <p className="muted small row-end-note">
            {blocking.map((s) => s.title).join(", ")} can't wait. Resolve {blocking.length === 1 ? "it" : "them"} before the term
            ends.
          </p>
        )}
      </section>

      <CommitmentsCard session={session} arc={arc} onDeliver={onDeliver} onExtend={onExtend} onAbandon={onAbandon} />

      <div className="grid-2">
        <PeopleCard session={session} />

        <section className="card">
          <CardTitle icon="hourglass">On the horizon</CardTitle>
          {session.pending.length === 0 ? (
            <p className="muted">Nothing from past decisions is still unfolding.</p>
          ) : (
            <ul className="horizon">
              {[...session.pending]
                .sort((a, b) => a.dueTerm - b.dueTerm)
                .map((p, i) =>
                  p.announced ? (
                    <li key={`p${i}`} className="scheduled-item">
                      <span className="badge literature-informed">{termLabel(p.dueTerm)}</span>
                      <span>
                        <strong>Scheduled</strong> from <em>{titleOf(p.scenarioId)}</em>
                        <span className="small muted scheduled-changes">
                          {describeProgramChanges(program, p.changes).join(" · ")}
                        </span>
                      </span>
                    </li>
                  ) : (
                    <li key={`p${i}`}>
                      <span className="badge illustrative">{termLabel(p.dueTerm)}</span>
                      <span>
                        A consequence of <em>{titleOf(p.scenarioId)}</em> is still unfolding.
                      </span>
                    </li>
                  ),
                )}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
