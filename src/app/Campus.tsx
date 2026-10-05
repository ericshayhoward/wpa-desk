import { useEffect, useState, type ReactNode } from "react";
import { RANK_LABELS, rangeLabel, type Rank, type StakeholderId, type TermAnalysis } from "../model";
import { CAST, SCENARIOS } from "../content";
import {
  DISSERTATION_LABELS,
  MORALE_ATTRITION,
  characterFor,
  describeProgramChanges,
  termLabel,
  termOf,
  type DissertationStatus,
  type TrainingSession,
  type YearEndSpec,
} from "../training";
import {
  DAY,
  WINDOW_LABELS,
  building,
  clockText,
  dayClock,
  foundersWindows,
  waitingByBuilding,
  type BuildingId,
  type WaitingItem,
  type WindowKind,
} from "./campus";
import { CampusScene } from "./CampusScene";
import { TRUST_METER, pct, stakeholderName, usd } from "./format";
import { Avatar, Icon } from "./ui";

interface Props {
  session: TrainingSession;
  analysis: TermAnalysis;
  reportDue?: YearEndSpec | null;
  staffingDue?: { unstaffed: number } | null;
  dissertation?: DissertationStatus | null;
  open: boolean;
  onToggle: (open: boolean) => void;
  onOpenScenario: (id: string) => void;
  /** Back to the desk's inbox, for the report and staffing items that are decided there. */
  onGoToDesk: () => void;
}

/**
 * The campus in the corner: a live map of Midland State. The time of day is
 * the term's admin hours, envelopes mark what's waiting and from where,
 * flags show trust, and Founders Hall's windows are this term's sections.
 * Tap a building to see who's inside and what the numbers mean there.
 */
export function Campus({ session, analysis, reportDue, staffingDue, dissertation, open, onToggle, onOpenScenario, onGoToDesk }: Props) {
  const [selected, setSelected] = useState<BuildingId | null>(null);
  const [hovered, setHovered] = useState<BuildingId | null>(null);
  // Once the arc is over, nothing is waiting: it's commencement.
  const waiting = session.ending ? new Map<BuildingId, WaitingItem[]>() : waitingByBuilding(session, SCENARIOS, reportDue, staffingDue);
  const count = [...waiting.values()].reduce((n, items) => n + items.length, 0);
  const clock = dayClock(session);

  // A new term (or a loaded session) starts with the map closed up.
  useEffect(() => setSelected(null), [session.termIndex, session.ending]);

  if (!open) {
    return (
      <button className="campus-fab no-print" onClick={() => onToggle(true)} aria-label={`Show the campus${count ? `, ${count} waiting` : ""}`}>
        <Icon name="campus" size={18} />
        <span>Campus</span>
        {count > 0 && (
          <span className="count-pill" aria-hidden="true">
            {count}
          </span>
        )}
      </button>
    );
  }

  const season = termOf(session.termIndex) === "fall" ? "Fall" : "Spring";
  const left = Math.max(0, session.adminHoursRemaining);
  const when = session.ending
    ? "Commencement on the quad"
    : clock.overtime > 0 && left === 0
      ? `${season} ${clock.label} · ${clock.overtime} hours past your admin time`
      : `${season} ${clock.label} · ${left} of ${session.adminHoursPerTerm} admin hours left`;
  const hint = hovered ?? selected;

  return (
    <aside
      className="campus no-print"
      aria-label="Campus"
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) setSelected(null);
      }}
    >
      <header className="campus-head">
        <span className="icon-chip" aria-hidden="true">
          <Icon name="campus" size={16} />
        </span>
        <div className="campus-title">
          <strong>Campus</strong>
          <span className="campus-when">{when}</span>
        </div>
        <button className="campus-icon-button" onClick={() => onToggle(false)} aria-label="Hide the campus">
          <Icon name="collapse" size={18} />
        </button>
      </header>

      <CampusScene
        session={session}
        analysis={analysis}
        clock={clock}
        waiting={waiting}
        selected={selected}
        onSelect={(id) => setSelected((s) => (s === id ? null : id))}
        onHover={setHovered}
      />

      <div className="campus-body">
        {selected ? (
          <BuildingCard
            id={selected}
            session={session}
            analysis={analysis}
            waiting={waiting.get(selected) ?? []}
            dissertation={dissertation}
            onClose={() => setSelected(null)}
            onOpenScenario={(id) => {
              setSelected(null);
              onOpenScenario(id);
            }}
            onGoToDesk={() => {
              setSelected(null);
              onGoToDesk();
            }}
          />
        ) : (
          <>
            <p className="campus-hint small" aria-live="polite">
              {hint ? (
                <>
                  <strong>{building(hint).name}.</strong> {building(hint).tagline}.
                </>
              ) : count > 0 ? (
                <>
                  {count} {count === 1 ? "thing is" : "things are"} waiting on you: look for the envelopes. Tap a building to see
                  who's inside.
                </>
              ) : (
                <>Nothing waiting on you. Tap a building to see who's inside and how things stand.</>
              )}
            </p>
            <Legend />
          </>
        )}
      </div>
    </aside>
  );
}

function Legend() {
  return (
    <details className="campus-legend small">
      <summary>How to read the campus</summary>
      <ul>
        <li>
          <strong>The day is your admin time.</strong> Each term starts at {DAY.start}&nbsp;a.m.; the sun sets as you spend
          hours, and it's {DAY.end - 12}&nbsp;p.m. when they're gone. Old Main's clock keeps the time.
        </li>
        <li>
          <strong>Envelopes</strong> float over whoever sent you something. Red ones can't wait.
        </li>
        <li>
          <strong>Flags</strong> show the weakest relationship inside: green at trust {TRUST_METER.high}+, gold in between, red
          under {TRUST_METER.low}.
        </li>
        <li>
          <strong>Founders Hall's windows</strong> are this term's sections, colored by who teaches them. Dark red ones have no
          instructor; crossed-out ones are cancelled.
        </li>
        <li>
          <strong>On the quad,</strong> students thin out as the day ends. Anyone waiting outside Founders Hall couldn't get a
          seat; someone carrying a box to the bus stop is an instructor who's had enough.
        </li>
        <li>
          <strong>The pin</strong> is your office in Humanities Hall.
        </li>
      </ul>
    </details>
  );
}

/** The group stakeholders who are also instructor pools, for their morale. */
const POOL_OF: Partial<Record<StakeholderId, Rank>> = { gta_cohort: "gta", adjunct_faculty: "adjunct" };

interface CardProps {
  id: BuildingId;
  session: TrainingSession;
  analysis: TermAnalysis;
  waiting: WaitingItem[];
  dissertation?: DissertationStatus | null;
  onClose: () => void;
  onOpenScenario: (id: string) => void;
  onGoToDesk: () => void;
}

function BuildingCard({ id, session, analysis, waiting, dissertation, onClose, onOpenScenario, onGoToDesk }: CardProps) {
  const b = building(id);
  const program = session.program;
  const people = program.stakeholders.filter((s) => b.occupants.includes(s.id));

  return (
    <section className="campus-card" aria-labelledby="campus-card-title">
      <div className="campus-card-head">
        <div>
          <h3 id="campus-card-title">{b.name}</h3>
          <p className="muted small">{b.tagline}.</p>
        </div>
        <button className="campus-icon-button" onClick={onClose} aria-label="Back to the map">
          <Icon name="close" size={16} />
        </button>
      </div>

      {waiting.length > 0 && (
        <>
          <h4>Waiting on you</h4>
          <ul className="campus-waiting">
            {waiting.map((w) => (
              <li key={`${w.kind}-${w.id}`}>
                {w.from && <Avatar program={program} id={w.from} size={26} />}
                <span className="campus-waiting-text">
                  <span className="small muted">
                    {w.from ? stakeholderName(program, w.from) : "Registrar"}
                    {w.urgent && <span className="badge urgent">can't wait</span>}
                  </span>
                  <span className="campus-subject">{w.subject}</span>
                </span>
                {w.kind === "scenario" ? (
                  <button className="secondary small" onClick={() => onOpenScenario(w.id)} aria-label={`Open “${w.subject}”`}>
                    Open
                  </button>
                ) : (
                  <button className="secondary small" onClick={onGoToDesk}>
                    To your desk
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {people.length > 0 && (
        <>
          <h4>Inside</h4>
          <ul className="campus-people">
            {people.map((s) => {
              const c = characterFor(CAST, s.id);
              const name = c?.shortName ?? s.name;
              const rank = POOL_OF[s.id];
              const pool = rank && program.instructors.find((p) => p.rank === rank);
              return (
                <li key={s.id}>
                  <Avatar program={program} id={s.id} size={26} />
                  <span className="campus-person">
                    <strong>{name}</strong>
                    <span className="muted small">
                      {s.id === "fyw_director" && session.stage === "wpa"
                        ? "On sabbatical: you're running the program this year"
                        : (c?.title ?? `Cares about ${s.priorities.slice(0, 2).join(" and ")}`)}
                      {pool && ` · morale ${pool.morale}`}
                    </span>
                  </span>
                  <span className="trust">
                    <meter
                      min={0}
                      max={100}
                      low={TRUST_METER.low}
                      high={TRUST_METER.high}
                      optimum={TRUST_METER.optimum}
                      value={s.trust}
                      aria-label={`${name}'s trust in you`}
                    />
                    <span className="num">{s.trust}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Facts id={id} session={session} analysis={analysis} dissertation={dissertation} />
    </section>
  );
}

/** What the numbers mean in this building. */
function Facts({ id, session, analysis, dissertation }: { id: BuildingId; session: TrainingSession; analysis: TermAnalysis; dissertation?: DissertationStatus | null }) {
  const program = session.program;
  const term = termOf(session.termIndex);
  const facts: ReactNode[] = [];

  if (id === "founders") {
    const { perWindow } = foundersWindows(analysis);
    const counts = new Map<WindowKind, number>();
    for (const line of analysis.staffing) if (line.sectionsAssigned) counts.set(line.rank, line.sectionsAssigned);
    if (analysis.unstaffedSections) counts.set("gap", analysis.unstaffedSections);
    if (analysis.totalSectionsCancelled) counts.set("cancelled", analysis.totalSectionsCancelled);
    const avg = analysis.totalSections ? analysis.totalSeatsServed / analysis.totalSections : 0;
    facts.push(
      <p key="n">
        {analysis.totalSections} sections of first-year writing meet here this {term}
        {perWindow > 1 ? ` (each window is ${perWindow} sections)` : ""}. Average class: {avg.toFixed(1)} students. Projected
        D/F/W: {rangeLabel(analysis.dfw, (x) => pct(x))}.
      </p>,
      <ul key="k" className="campus-key">
        {[...counts].map(([kind, n]) => (
          <li key={kind}>
            <span className={`campus-swatch swatch-${kind}`} aria-hidden="true" />
            {WINDOW_LABELS[kind]} <span className="num muted">{n}</span>
          </li>
        ))}
      </ul>,
    );
    if (analysis.totalSeatsUnserved > 0) {
      facts.push(
        <p key="u" className="down">
          {analysis.totalSeatsUnserved} students couldn't get a seat this term.
        </p>,
      );
    }
    const scheduled = session.pending.filter((p) => p.announced).sort((a, b) => a.dueTerm - b.dueTerm);
    if (scheduled.length) {
      facts.push(
        <div key="s">
          <h4>On the sign out front</h4>
          <ul className="campus-scheduled">
            {scheduled.map((p, i) => (
              <li key={i}>
                <span className="badge literature-informed">{termLabel(p.dueTerm)}</span>{" "}
                {describeProgramChanges(program, p.changes).join(" · ") || p.note}
              </li>
            ))}
          </ul>
        </div>,
      );
    }
  }

  if (id === "humanities") {
    const low = program.instructors.filter((p) => (MORALE_ATTRITION.ranks as readonly Rank[]).includes(p.rank) && p.morale < MORALE_ATTRITION.threshold);
    facts.push(
      <ul key="m" className="campus-key">
        {program.instructors.map((p) => (
          <li key={p.rank}>
            <span className={`campus-swatch swatch-${p.rank}`} aria-hidden="true" />
            {RANK_LABELS[p.rank]}: {p.headcount}, morale <span className={`num ${p.morale < MORALE_ATTRITION.threshold ? "down" : ""}`}>{p.morale}</span>
          </li>
        ))}
      </ul>,
    );
    facts.push(
      <p key="l" className={low.length ? "down" : "muted"}>
        {low.length
          ? `${low.map((p) => RANK_LABELS[p.rank]).join(" and ")} morale is under ${MORALE_ATTRITION.threshold}: one leaves each term until it recovers.`
          : `Below ${MORALE_ATTRITION.threshold} morale, adjuncts and lecturers start leaving.`}
      </p>,
    );
  }

  if (id === "arts_sciences") {
    const b = analysis.budgetBalance;
    facts.push(
      <p key="b">
        Instruction budget this term:{" "}
        <strong className={b < 0 ? "down" : b > 0 ? "up" : ""}>
          {b < 0 ? `${usd(-b)} short` : b === 0 ? "balanced" : `${usd(b)} to spare`}
        </strong>
        . The program pays {usd(analysis.cost.program)} for its sections; the department covers {usd(analysis.cost.department)}.
      </p>,
    );
  }

  if (id === "old_main") {
    const clock = dayClock(session);
    facts.push(
      <p key="c">
        The clock reads {clockText(clock.hour)}
        {session.ending ? "." : `: ${Math.max(0, session.adminHoursRemaining)} of ${session.adminHoursPerTerm} admin hours left this term.`}
      </p>,
      <p key="p">
        <strong>{program.politicalCapital} political capital</strong> to spend on fights in this building. You earn it back by
        delivering what you promise.
      </p>,
    );
  }

  if (id === "library" && dissertation) {
    facts.push(
      <p key="d">
        Your dissertation: <strong>{Math.round(dissertation.progress * 100)}%</strong> ({DISSERTATION_LABELS[dissertation.status].toLowerCase()}).
        Admin hours you leave unspent each term come up here to the carrel.
      </p>,
    );
  }

  if (id === "quad") {
    facts.push(
      <p key="q">
        {analysis.totalSeatsServed.toLocaleString("en-US")} students are taking first-year writing this {term}
        {analysis.totalSeatsUnserved > 0 ? `; ${analysis.totalSeatsUnserved} couldn't get a seat` : ""}.
      </p>,
    );
  }

  return facts.length ? <div className="campus-facts small">{facts}</div> : null;
}
