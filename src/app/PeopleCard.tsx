import { RANK_LABELS, type StakeholderId } from "../model";
import { CAST } from "../content";
import { DEFAULT_PERSUASION, MORALE_ATTRITION, characterFor, type TrainingSession } from "../training";

/** The people you work with: named characters first, then groups, then instructor morale. */
export function PeopleCard({ session }: { session: TrainingSession }) {
  const program = session.program;
  const people = program.stakeholders.filter((s) => characterFor(CAST, s.id));
  const groups = program.stakeholders.filter((s) => !characterFor(CAST, s.id));

  return (
    <section className="card people">
      <h2>People</h2>
      <ul className="people-list">
        {people.map((s) => {
          const c = characterFor(CAST, s.id)!;
          return (
            <li key={s.id}>
              <details>
                <summary>
                  <span className="person">
                    <strong>{c.name}</strong>
                    <span className="muted small">{c.title}</span>
                  </span>
                  <TrustMeter id={s.id} name={c.name} trust={s.trust} />
                </summary>
                <div className="person-detail small">
                  <p>{c.bio}</p>
                  <p>
                    <strong>Responds to:</strong> {c.responds}
                  </p>
                  <p className="muted">
                    Persuaded by a memo with the evidence {c.shortName} needs at trust {c.persuasion.withEvidence}; takes your word
                    without it at {c.persuasion.withoutEvidence}.
                  </p>
                </div>
              </details>
            </li>
          );
        })}
      </ul>

      <h3>Groups</h3>
      <ul className="trust-list">
        {groups.map((s) => (
          <li key={s.id}>
            <span>{s.name}</span>
            <TrustMeter id={s.id} name={s.name} trust={s.trust} />
          </li>
        ))}
      </ul>
      <p className="muted small">
        Groups are persuaded at trust {DEFAULT_PERSUASION.withEvidence} with evidence, {DEFAULT_PERSUASION.withoutEvidence} without.
      </p>

      <h3>Instructor morale</h3>
      <ul className="trust-list">
        {program.instructors.map((p) => (
          <li key={p.rank}>
            <span>{RANK_LABELS[p.rank]}</span>
            <meter
              min={0}
              max={100}
              low={MORALE_ATTRITION.threshold}
              high={65}
              optimum={80}
              value={p.morale}
              aria-label={`${RANK_LABELS[p.rank]} morale`}
            />
            <span className={`num ${p.morale < MORALE_ATTRITION.threshold ? "down" : ""}`}>{p.morale}</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Below {MORALE_ATTRITION.threshold}, adjuncts and lecturers start leaving: one each term until morale recovers.
      </p>
    </section>
  );
}

function TrustMeter({ id, name, trust }: { id: StakeholderId; name: string; trust: number }) {
  return (
    <span className="trust" data-stakeholder={id}>
      <meter min={0} max={100} low={35} high={65} optimum={80} value={trust} aria-label={`${name} trust`} />
      <span className="num">{trust}</span>
    </span>
  );
}
