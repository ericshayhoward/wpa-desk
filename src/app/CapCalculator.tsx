import { useMemo, useState } from "react";
import {
  DEFAULT_ASSUMPTIONS,
  RANK_LABELS,
  analyzeTerm,
  applyChanges,
  compareTerms,
  type Program,
  type ProgramChange,
  type Range,
  type Term,
} from "../model";
import { capAnalysisEvidence, type EvidenceDraft } from "../training";
import { signed, usd } from "./format";

interface Props {
  program: Program;
  /** When provided, the calculator offers to save its result as memo evidence. */
  onSaveEvidence?: (draft: EvidenceDraft) => void;
  /** Caps to preload (e.g., the proposal in a scenario document). */
  initialCaps?: Record<string, number>;
}

export function CapCalculator({ program, onSaveEvidence, initialCaps }: Props) {
  const [term, setTerm] = useState<Term>("fall");
  const [caps, setCaps] = useState<Record<string, number>>({ ...program.policies.caps, ...initialCaps });
  const [saved, setSaved] = useState<string | null>(null);

  const { before, after } = useMemo(() => {
    const changes: ProgramChange[] = Object.entries(caps)
      .filter(([id, cap]) => cap >= 1 && cap !== program.policies.caps[id])
      .map(([courseId, cap]) => ({ kind: "setCap", courseId, cap }));
    const proposed = applyChanges(program, changes);
    return {
      before: analyzeTerm(program, term, DEFAULT_ASSUMPTIONS),
      after: analyzeTerm(proposed, term, DEFAULT_ASSUMPTIONS),
    };
  }, [program, caps, term]);
  const diff = compareTerms(before, after);
  const changed = Object.entries(caps).some(([id, cap]) => cap !== program.policies.caps[id]);

  return (
    <section className="tool">
      <header className="tool-head">
        <div>
          <h2>Class cap calculator</h2>
          <p className="muted">What happens to sections, staffing, cost, and outcomes if caps change?</p>
          <p className="whatif small">What-if only: this doesn't change your program. Caps change through decisions.</p>
        </div>
        <div className="segmented" role="group" aria-label="Term">
          {(["fall", "spring"] as Term[]).map((t) => (
            <button key={t} aria-pressed={term === t} onClick={() => setTerm(t)}>
              {t === "fall" ? "Fall" : "Spring"}
            </button>
          ))}
        </div>
      </header>

      <div className="caps">
        {program.courses.map((c) => (
          <label key={c.id} className="cap-input">
            <span>
              <strong>{c.id}</strong> {c.title}
            </span>
            <input
              type="number"
              min={10}
              max={40}
              value={caps[c.id] ?? ""}
              onChange={(e) => setCaps({ ...caps, [c.id]: Number(e.target.value) })}
            />
            <span className="muted small">currently {program.policies.caps[c.id]}</span>
          </label>
        ))}
        <button className="link" disabled={!changed} onClick={() => setCaps({ ...program.policies.caps })}>
          Reset to current caps
        </button>
      </div>

      {onSaveEvidence && (
        <div className="evidence-bar">
          <button
            className="primary"
            disabled={!changed}
            onClick={() => {
              const draft = capAnalysisEvidence(program, caps, before, after);
              onSaveEvidence(draft);
              setSaved(draft.label);
            }}
          >
            Save this comparison as evidence
          </button>
          <span className="muted small" aria-live="polite">
            {saved ? `Saved: ${saved}` : changed ? "You can attach saved evidence to a memo." : "Change a cap to compare."}
          </span>
        </div>
      )}

      <table className="compare">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Current</th>
            <th scope="col">Proposed</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Sections" a={before.totalSections} b={after.totalSections} fmt={String} />
          <Row label="Program instruction cost" a={before.cost.program} b={after.cost.program} fmt={usd} lowerIsGood />
          <Row label="Budget balance" a={before.budgetBalance} b={after.budgetBalance} fmt={usd} />
          <tr>
            <th scope="row">Projected D/F/W</th>
            <td>{rangeText(before.dfw)}</td>
            <td>{rangeText(after.dfw)}</td>
            <td className={tone(diff.dfwMid, true)}>{signed(diff.dfwMid * 100, 1)} pts</td>
          </tr>
          {after.unstaffedSections > 0 || before.unstaffedSections > 0 ? (
            <Row label="Unstaffed sections" a={before.unstaffedSections} b={after.unstaffedSections} fmt={String} lowerIsGood />
          ) : null}
        </tbody>
      </table>

      {diff.courseNotes.length > 0 && (
        <div className="notice small" role="note">
          {diff.courseNotes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}

      <h3>By course</h3>
      <table className="compare">
        <thead>
          <tr>
            <th scope="col">Course</th>
            <th scope="col">Seats</th>
            <th scope="col">Cap</th>
            <th scope="col">Sections</th>
            <th scope="col">Average size</th>
          </tr>
        </thead>
        <tbody>
          {after.courses.map((a) => {
            const b = before.courses.find((c) => c.courseId === a.courseId)!;
            const rounded = a.seats > 0 && !Number.isInteger(a.exactSections);
            return (
              <tr key={a.courseId}>
                <th scope="row">{a.courseId}</th>
                <td>{a.seats}</td>
                <td>{b.cap === a.cap ? a.cap : `${b.cap} → ${a.cap}`}</td>
                <td>
                  {b.sections === a.sections ? a.sections : `${b.sections} → ${a.sections}`}
                  {rounded && (
                    <span className="muted small"> ({a.exactSections.toFixed(1)}, rounded up)</span>
                  )}
                </td>
                <td>
                  {b.avgSectionSize.toFixed(1) === a.avgSectionSize.toFixed(1)
                    ? a.avgSectionSize.toFixed(1)
                    : `${b.avgSectionSize.toFixed(1)} → ${a.avgSectionSize.toFixed(1)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Who teaches</h3>
      <table className="compare">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Sections</th>
            <th scope="col">People without sections</th>
            <th scope="col">Students per full load</th>
            <th scope="col">Feedback hours per full load</th>
          </tr>
        </thead>
        <tbody>
          {after.staffing.map((s) => {
            const b = before.staffing.find((x) => x.rank === s.rank)!;
            return (
              <tr key={s.rank}>
                <th scope="row">{RANK_LABELS[s.rank]}</th>
                <td>
                  {s.sectionsAssigned}
                  <Delta value={s.sectionsAssigned - b.sectionsAssigned} />
                </td>
                <td>
                  {s.peopleWithoutSections}
                  <Delta value={s.peopleWithoutSections - b.peopleWithoutSections} higherIsBad />
                </td>
                <td>{Math.round(s.studentsPerFullLoad)}</td>
                <td>
                  {Math.round(s.feedbackHoursPerFullLoad.mid)}
                  <span className="muted small">
                    {" "}
                    ({Math.round(s.feedbackHoursPerFullLoad.low)}–{Math.round(s.feedbackHoursPerFullLoad.high)})
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <details className="why" open>
        <summary>How these numbers were reached</summary>
        <ul>
          {after.trace.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>

      <details className="why">
        <summary>Assumptions</summary>
        <ul className="assumptions">
          {Object.values(DEFAULT_ASSUMPTIONS).map((a) => (
            <li key={a.id}>
              <div>
                <strong>{a.label}</strong>: {a.value} {a.unit}{" "}
                <span className="muted">
                  (range {a.low}–{a.high})
                </span>{" "}
                <span className={`badge ${a.confidence}`}>{a.confidence}</span>
              </div>
              <p className="muted small">{a.description}</p>
              {a.sources.length > 0 && <p className="small">Source: {a.sources.join("; ")}</p>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Row(props: { label: string; a: number; b: number; fmt: (n: number) => string; lowerIsGood?: boolean }) {
  const d = props.b - props.a;
  return (
    <tr>
      <th scope="row">{props.label}</th>
      <td>{props.fmt(props.a)}</td>
      <td>{props.fmt(props.b)}</td>
      <td className={tone(d, props.lowerIsGood)}>{d === 0 ? "—" : (d > 0 ? "+" : "−") + props.fmt(Math.abs(d))}</td>
    </tr>
  );
}

function Delta({ value, higherIsBad }: { value: number; higherIsBad?: boolean }) {
  if (value === 0) return null;
  return <span className={`delta ${tone(value, higherIsBad)}`}>{signed(value, 0)}</span>;
}

/** Colors a change without calling it good or bad outright; direction depends on the metric. */
function tone(d: number, lowerIsGood = false): string {
  if (d === 0) return "";
  return (d > 0) !== lowerIsGood ? "up" : "down";
}

function rangeText(r: Range): string {
  return `${(r.mid * 100).toFixed(1)}% (${(r.low * 100).toFixed(1)}–${(r.high * 100).toFixed(1)})`;
}
