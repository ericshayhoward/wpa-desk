import {
  COMMITMENT_EFFECTS,
  cannotDeliver,
  cannotExtend,
  termLabel,
  type Arc,
  type Commitment,
  type TrainingSession,
} from "../training";
import { stakeholderName } from "./format";
import { CardTitle } from "./ui";

interface Props {
  session: TrainingSession;
  /** The arc being played; extensions aren't offered in its final term. */
  arc?: Arc;
  onDeliver: (id: string) => void;
  onExtend: (id: string) => void;
  onAbandon: (id: string) => void;
}

export function CommitmentsCard({ session, arc, onDeliver, onExtend, onAbandon }: Props) {
  const open = session.commitments.filter((c) => c.status === "open");
  const due = open.filter((c) => c.dueTerm <= session.termIndex);
  const upcoming = open.filter((c) => c.dueTerm > session.termIndex);
  if (open.length === 0) return null;

  const who = (c: Commitment) => stakeholderName(session.program, c.audience);

  return (
    <section className="card commitments">
      <CardTitle icon="promise">Commitments</CardTitle>
      <p className="muted small">
        Promises from your memos. Delivering takes admin hours and earns trust with the reader (+
        {COMMITMENT_EFFECTS.keptTrust}) and political capital (+{COMMITMENT_EFFECTS.keptCapital}); anything still open when the
        term ends is missed ({COMMITMENT_EFFECTS.missedTrust}).
      </p>

      {due.length > 0 && (
        <>
          <h3>Due this term</h3>
          <ul className="commitment-list">
            {due.map((c) => {
              const blocked = cannotDeliver(session, c);
              const noExtension = cannotExtend(session, c, arc);
              return (
                <li key={c.id} className="due">
                  <div>
                    <strong>{c.text}</strong>
                    <div className="small muted">
                      To {who(c)} · {c.effortHours} admin hours{c.extended && " · already extended once"}
                    </div>
                    {blocked && <div className="small down">{blocked}</div>}
                    {!c.extended && noExtension && <div className="small muted">{noExtension}</div>}
                  </div>
                  <div className="slot-actions">
                    <button className="primary" disabled={Boolean(blocked)} onClick={() => onDeliver(c.id)}>
                      Deliver
                    </button>
                    {!noExtension && (
                      <button className="secondary" onClick={() => onExtend(c.id)}>
                        Ask for an extension ({COMMITMENT_EFFECTS.extensionTrust} trust)
                      </button>
                    )}
                    <button className="link" onClick={() => onAbandon(c.id)}>
                      Tell them it won't happen
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h3>Coming up</h3>
          <ul className="commitment-list">
            {upcoming.map((c) => {
              const blocked = cannotDeliver(session, c);
              return (
                <li key={c.id}>
                  <div>
                    <span className="badge literature-informed">due {termLabel(c.dueTerm)}</span> {c.text}
                    <div className="small muted">
                      To {who(c)} · {c.effortHours} admin hours
                    </div>
                  </div>
                  <div className="slot-actions">
                    <button className="secondary" disabled={Boolean(blocked)} title={blocked ?? undefined} onClick={() => onDeliver(c.id)}>
                      Deliver early
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
