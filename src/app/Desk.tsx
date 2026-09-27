import { SCENARIOS } from "../content";
import {
  COMMITMENT_EFFECTS,
  blockingScenarios,
  fillTemplate,
  isFinalTerm,
  termLabel,
  type Arc,
  type Commitment,
  type PendingEffect,
  type TrainingSession,
} from "../training";
import { CommitmentsCard } from "./CommitmentsCard";
import { PeopleCard } from "./PeopleCard";
import { stakeholderName } from "./format";

interface Props {
  session: TrainingSession;
  /** The arc being played, if any. */
  arc?: Arc;
  /** What happened when the term advanced: role changes, delayed effects, and missed commitments. */
  landed: { effects: PendingEffect[]; missed: Commitment[]; drift: string[]; milestones: string[] };
  onOpen: (scenarioId: string) => void;
  onNextTerm: () => void;
  onDeliver: (id: string) => void;
  onExtend: (id: string) => void;
  onAbandon: (id: string) => void;
}

export function Desk({ session, arc, landed, onOpen, onNextTerm, onDeliver, onExtend, onAbandon }: Props) {
  const program = session.program;
  const inbox = session.inbox.map((id) => SCENARIOS.find((s) => s.id === id)!).filter(Boolean);
  const titleOf = (id: string) => SCENARIOS.find((s) => s.id === id)?.title ?? id;
  const blocking = blockingScenarios(session, SCENARIOS);
  const final = isFinalTerm(session, arc);

  return (
    <div className="desk">
      {(landed.effects.length > 0 || landed.missed.length > 0 || landed.drift.length > 0 || landed.milestones.length > 0) && (
        <section className="notice" aria-live="polite">
          <h2>Since last term</h2>
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
        {final ? (
          <p className="muted small row-end-note">
            {termLabel(session.termIndex)} is the final term of {arc!.title}. The Year 3 annual report and your ending
            aren't built yet.
          </p>
        ) : (
          <div className="row-end">
            <button
              className={inbox.length ? "secondary" : "primary"}
              disabled={blocking.length > 0}
              onClick={onNextTerm}
            >
              {inbox.length ? "Leave these for next term and advance" : `Advance to ${termLabel(session.termIndex + 1)}`}
            </button>
          </div>
        )}
        {blocking.length > 0 && (
          <p className="muted small row-end-note">
            {blocking.map((s) => s.title).join(", ")} can't wait. Resolve {blocking.length === 1 ? "it" : "them"} before the term
            ends.
          </p>
        )}
      </section>

      <CommitmentsCard session={session} onDeliver={onDeliver} onExtend={onExtend} onAbandon={onAbandon} />

      <div className="grid-2">
        <PeopleCard session={session} />

        <section className="card">
          <h2>On the horizon</h2>
          {session.pending.length === 0 ? (
            <p className="muted">Nothing from past decisions is still unfolding.</p>
          ) : (
            <ul className="horizon">
              {session.pending.map((p, i) => (
                <li key={`p${i}`}>
                  <span className="badge illustrative">{termLabel(p.dueTerm)}</span> A consequence of{" "}
                  <em>{titleOf(p.scenarioId)}</em> is still unfolding.
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
