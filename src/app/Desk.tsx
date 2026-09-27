import { SCENARIOS } from "../content";
import { blockingScenarios, fillTemplate, termLabel, type PendingEffect, type TrainingSession } from "../training";
import { stakeholderName } from "./format";

interface Props {
  session: TrainingSession;
  /** Delayed effects that landed when the term advanced. */
  landed: PendingEffect[];
  onOpen: (scenarioId: string) => void;
  onNextTerm: () => void;
}

export function Desk({ session, landed, onOpen, onNextTerm }: Props) {
  const program = session.program;
  const inbox = session.inbox.map((id) => SCENARIOS.find((s) => s.id === id)!).filter(Boolean);
  const openCommitments = session.commitments.filter((c) => c.status === "open");
  const titleOf = (id: string) => SCENARIOS.find((s) => s.id === id)?.title ?? id;
  const blocking = blockingScenarios(session, SCENARIOS);

  return (
    <div className="desk">
      {landed.length > 0 && (
        <section className="notice" aria-live="polite">
          <h2>Since last term</h2>
          {landed.map((p, i) => (
            <p key={i}>
              <span className="muted small">{titleOf(p.scenarioId)}:</span> {p.note}
            </p>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Inbox</h2>
        {inbox.length === 0 ? (
          <p className="muted">Nothing waiting on you this term.</p>
        ) : (
          <ul className="inbox">
            {inbox.map((s) => {
              const doc = s.documents[0]!;
              return (
                <li key={s.id}>
                  <button className="inbox-item" onClick={() => onOpen(s.id)}>
                    <span className="inbox-from">
                      {stakeholderName(program, doc.from)}
                      {s.urgent && <span className="badge urgent">urgent</span>}
                    </span>
                    <span className="inbox-subject">{fillTemplate(doc.subject, session)}</span>
                    <span className="muted small">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="row-end">
          <button
            className={inbox.length ? "secondary" : "primary"}
            disabled={blocking.length > 0}
            onClick={onNextTerm}
          >
            {inbox.length ? "Leave these for next term and advance" : `Advance to ${termLabel(session.termIndex + 1)}`}
          </button>
        </div>
        {blocking.length > 0 && (
          <p className="muted small row-end-note">
            {blocking.map((s) => s.title).join(", ")} can't wait. Resolve {blocking.length === 1 ? "it" : "them"} before the term
            ends.
          </p>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Stakeholders</h2>
          <ul className="trust-list">
            {program.stakeholders.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <meter min={0} max={100} low={35} high={65} optimum={80} value={s.trust} aria-label={`${s.name} trust`} />
                <span className="num">{s.trust}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>On the horizon</h2>
          {session.pending.length === 0 && openCommitments.length === 0 ? (
            <p className="muted">No pending consequences or commitments.</p>
          ) : (
            <ul className="horizon">
              {session.pending.map((p, i) => (
                <li key={`p${i}`}>
                  <span className="badge illustrative">{termLabel(p.dueTerm)}</span> A consequence of{" "}
                  <em>{titleOf(p.scenarioId)}</em> is still unfolding.
                </li>
              ))}
              {openCommitments.map((c) => (
                <li key={c.id}>
                  <span className="badge literature-informed">due {termLabel(c.dueTerm)}</span> You committed: {c.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
