import { RANK_LABELS, type Program, type TermComparison } from "../model";
import { persuasionSummary, termLabel, type DecisionOutcome, type ScheduledPreview } from "../training";
import { ReflectionEditor } from "./ReflectionEditor";
import { namesFor, signed, stakeholderName, usd } from "./format";
import { Avatar, CardTitle, Icon, Prose } from "./ui";

interface Props {
  outcome: DecisionOutcome;
  program: Program;
  /** The reflection already saved for this scenario, if any. */
  reflection: string | undefined;
  onReflect: (text: string) => void;
  onDone: () => void;
  onDossier: () => void;
}

export function OutcomeView({ outcome, program, reflection, onReflect, onDone, onDossier }: Props) {
  const {
    scenario,
    option,
    consequence,
    persuaded,
    missingEvidence,
    persuasion,
    reply,
    trustChanges,
    politicalCapital,
    impact,
    changeDescriptions,
    queued,
    scheduled,
  } = outcome;
  // Nothing changes this term: the decision's program effects are all scheduled for later.
  const nowUnchanged = changeDescriptions.length === 0 && !changed(impact.comparison);
  // Unannounced effects stay a surprise; only say when something will come back.
  const surprises = queued.filter((p) => !p.announced).map((p) => p.inTerms).sort((a, b) => a - b)[0] ?? 0;

  return (
    <div className="outcome">
      <div className="outcome-head">
        <div>
          <p className="scenario-kicker">{scenario.title}</p>
          <h2>You chose: {option.label}</h2>
        </div>
        {persuasion && (
          <span className={`stamp ${persuaded ? "good" : "bad"}`} aria-hidden="true">
            {persuaded ? "Persuaded" : "Not persuaded"}
          </span>
        )}
      </div>

      {persuasion && (
        <p className={`banner ${persuaded ? "good" : "bad"}`}>
          {persuasionSummary(persuasion, persuaded!, missingEvidence, namesFor(program))}
        </p>
      )}

      <section className="card narrative">
        <Prose text={consequence.narrative} />
        {reply && (
          <blockquote className="reply">
            <p>{reply.body}</p>
            <footer>— {stakeholderName(program, reply.from)}</footer>
          </blockquote>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <CardTitle icon="users" level={3}>
            Relationships
          </CardTitle>
          {trustChanges.length === 0 ? (
            <p className="muted">No change in trust.</p>
          ) : (
            <ul className="changes">
              {trustChanges.map((t) => (
                <li key={t.stakeholder}>
                  <span>{stakeholderName(program, t.stakeholder)}</span>
                  <span className="num trust-change">
                    {t.before} → {t.after}{" "}
                    <span className={`pill-delta ${t.after > t.before ? "up" : "down"}`}>({signed(t.after - t.before)})</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="small">
            Political capital: {politicalCapital.before} → {politicalCapital.after}
          </p>
        </section>

        {nowUnchanged && scheduled.length > 0 ? (
          <ScheduledCard preview={scheduled[0]!} />
        ) : (
          <section className="card">
            <CardTitle icon="sliders" level={3}>
              Projected effect this {impact.term}
            </CardTitle>
            <Impact descriptions={changeDescriptions} c={impact.comparison} />
            {surprises > 0 && (
              <p className="small muted">
                This decision isn't finished with you. Something from it will come back in {surprises} term
                {surprises > 1 ? "s" : ""}.
              </p>
            )}
          </section>
        )}
      </div>

      {scheduled.slice(nowUnchanged ? 1 : 0).map((p) => (
        <ScheduledCard key={p.dueTerm} preview={p} />
      ))}
      {nowUnchanged && scheduled.length > 0 && surprises > 0 && (
        <p className="small muted">
          This decision isn't finished with you. Something else from it will come back in {surprises} term
          {surprises > 1 ? "s" : ""}.
        </p>
      )}

      <section className="card debrief">
        <CardTitle icon="sparkle" level={3}>
          Debrief
        </CardTitle>
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
                  <Avatar program={program} id={p.stakeholder} size={34} />
                  <span>
                    <strong>{stakeholderName(program, p.stakeholder)}:</strong> <span className="view-quote">“{p.view}”</span>
                  </span>
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

      <section className="card">
        <CardTitle icon="pen" level={3}>
          Reflect
        </CardTitle>
        <ReflectionEditor key={reflection ?? ""} scenarioTitle={scenario.title} saved={reflection} onSave={onReflect} />
      </section>

      <div className="row-end">
        <button className="secondary" onClick={onDossier}>
          See the case file
        </button>
        <button className="primary" onClick={onDone}>
          Back to desk
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </div>
  );
}


function changed(c: TermComparison): boolean {
  return c.sections !== 0 || c.programCost !== 0 || c.budgetBalance !== 0 || c.unstaffedSections !== 0 || c.seatsUnserved !== 0;
}

/** A decision's effect on one term: what changes, then what that does to the numbers. */
function Impact({ descriptions, c }: { descriptions: string[]; c: TermComparison }) {
  const staffingChanges = Object.entries(c.sectionsByRank).filter(([, d]) => d !== 0);
  return (
    <>
      {descriptions.length > 0 && (
        <ul className="plan small">
          {descriptions.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      {!changed(c) ? (
        <p className="muted">Sections, staffing, and budget are unchanged.</p>
      ) : (
        <ul className="changes">
          {c.unstaffedSections !== 0 && (
            <li>
              <span>Unstaffed sections</span>
              <span className={`num ${c.unstaffedSections < 0 ? "up" : "down"}`}>{signed(c.unstaffedSections)}</span>
            </li>
          )}
          {c.seatsUnserved !== 0 && (
            <li>
              <span>Students without a seat</span>
              <span className={`num ${c.seatsUnserved > 0 ? "down" : "up"}`}>{signed(c.seatsUnserved)}</span>
            </li>
          )}
          <li>
            <span>Sections offered</span>
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
    </>
  );
}

/** An announced change: when it lands and what it's projected to do then. */
function ScheduledCard({ preview }: { preview: ScheduledPreview }) {
  return (
    <section className="card scheduled">
      <CardTitle icon="calendar" level={3}>
        Scheduled for {termLabel(preview.dueTerm)}
      </CardTitle>
      <p className="muted small">Announced now. It takes effect when the term begins; projected against the program as it stands.</p>
      <Impact descriptions={preview.descriptions} c={preview.comparison} />
    </section>
  );
}
