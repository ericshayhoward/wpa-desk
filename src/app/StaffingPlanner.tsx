import { useMemo, useState } from "react";
import {
  DEFAULT_ASSUMPTIONS,
  RANK_LABELS,
  analyzeTerm,
  applyChanges,
  compareTerms,
  describeChange,
  type InstructorPool,
  type Program,
  type ProgramChange,
  type Rank,
  type Term,
} from "../model";
import { staffingPlanEvidence, type EvidenceDraft } from "../training";
import { pct, signed, usd } from "./format";
import { Delta, EvidenceBar, Row, TermToggle, WhatIf, tone } from "./ToolParts";

interface Props {
  program: Program;
  /** When provided, the planner offers to save its result as memo evidence. */
  onSaveEvidence?: (draft: EvidenceDraft) => void;
  initialTerm?: Term;
}

interface PoolPlan {
  headcount: number;
  sectionsPerTerm: number;
  costPerSection: number;
  overloadMax: number;
  overloadCost: number;
}

function planOf(pool: InstructorPool): PoolPlan {
  return {
    headcount: pool.headcount,
    sectionsPerTerm: pool.sectionsPerTerm,
    costPerSection: pool.costPerSection,
    overloadMax: pool.overload?.maxPerPerson ?? 0,
    overloadCost: pool.overload?.costPerSection ?? pool.costPerSection,
  };
}

/** Translates the edited plan into the ProgramChanges it implies. */
function changesFor(program: Program, term: Term, pools: Record<string, PoolPlan>, cancel: Record<string, number>): ProgramChange[] {
  const changes: ProgramChange[] = [];
  for (const pool of program.instructors) {
    const plan = pools[pool.rank];
    if (!plan) continue;
    const base = planOf(pool);
    if (plan.headcount !== base.headcount) changes.push({ kind: "adjustHeadcount", rank: pool.rank, delta: plan.headcount - base.headcount });
    if (plan.sectionsPerTerm !== base.sectionsPerTerm) changes.push({ kind: "setSectionsPerTerm", rank: pool.rank, sections: plan.sectionsPerTerm });
    if (plan.costPerSection !== base.costPerSection) changes.push({ kind: "setCostPerSection", rank: pool.rank, cost: plan.costPerSection });
    if (plan.overloadMax !== base.overloadMax || (plan.overloadMax > 0 && plan.overloadCost !== base.overloadCost)) {
      changes.push({ kind: "setOverload", rank: pool.rank, maxPerPerson: plan.overloadMax, costPerSection: plan.overloadCost });
    }
  }
  for (const course of program.courses) {
    const current = (program.cancellations ?? []).find((c) => c.courseId === course.id && c.term === term)?.sections ?? 0;
    const wanted = cancel[course.id] ?? current;
    if (wanted !== current) changes.push({ kind: "cancelSections", courseId: course.id, term, sections: wanted });
  }
  return changes;
}

export function StaffingPlanner({ program, onSaveEvidence, initialTerm = "fall" }: Props) {
  const [term, setTerm] = useState<Term>(initialTerm);
  const basePools = () => Object.fromEntries(program.instructors.map((p) => [p.rank, planOf(p)]));
  const [pools, setPools] = useState<Record<string, PoolPlan>>(basePools);
  const [cancel, setCancel] = useState<Record<string, number>>({});

  const changes = useMemo(() => changesFor(program, term, pools, cancel), [program, term, pools, cancel]);
  const { before, after } = useMemo(
    () => ({
      before: analyzeTerm(program, term, DEFAULT_ASSUMPTIONS),
      after: analyzeTerm(applyChanges(program, changes), term, DEFAULT_ASSUMPTIONS),
    }),
    [program, term, changes],
  );
  const diff = compareTerms(before, after);
  const changed = changes.length > 0;
  const setPool = (rank: Rank, patch: Partial<PoolPlan>) => setPools({ ...pools, [rank]: { ...pools[rank]!, ...patch } });
  const reset = () => {
    setPools(basePools());
    setCancel({});
  };

  return (
    <section className="tool">
      <header className="tool-head">
        <div>
          <h2>Staffing planner</h2>
          <p className="muted">Who will teach every section, what it costs, and what happens when there aren't enough people?</p>
          <WhatIf what="Staffing and schedules" />
        </div>
        <TermToggle
          term={term}
          onChange={(t) => {
            setTerm(t);
            setCancel({});
          }}
        />
      </header>

      <Coverage analysis={after} />

      <h3>Instructor pools</h3>
      <div className="table-scroll">
        <table className="compare pools">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">People</th>
              <th scope="col">Sections each</th>
              <th scope="col">Pay per section</th>
              <th scope="col">Overloads per person</th>
              <th scope="col">Overload pay</th>
            </tr>
          </thead>
          <tbody>
            {program.instructors.map((pool) => {
              const plan = pools[pool.rank]!;
              const label = RANK_LABELS[pool.rank];
              return (
                <tr key={pool.rank}>
                  <th scope="row">
                    {label}
                    {pool.note && <span className="pool-note">{pool.note}</span>}
                  </th>
                  <td>
                    <NumberField label={`${label}: people`} value={plan.headcount} min={0} onChange={(v) => setPool(pool.rank, { headcount: v })} />
                  </td>
                  <td>
                    <NumberField label={`${label}: sections each`} value={plan.sectionsPerTerm} min={0} max={6} onChange={(v) => setPool(pool.rank, { sectionsPerTerm: v })} />
                  </td>
                  <td>
                    <NumberField label={`${label}: pay per section`} value={plan.costPerSection} min={0} step={100} wide onChange={(v) => setPool(pool.rank, { costPerSection: v })} />
                  </td>
                  <td>
                    <NumberField label={`${label}: overloads per person`} value={plan.overloadMax} min={0} max={3} onChange={(v) => setPool(pool.rank, { overloadMax: v })} />
                  </td>
                  <td>
                    {plan.overloadMax > 0 ? (
                      <NumberField label={`${label}: overload pay`} value={plan.overloadCost} min={0} step={100} wide onChange={(v) => setPool(pool.rank, { overloadCost: v })} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Cancel sections</h3>
      <p className="muted small">Cancelling closes a staffing gap without hiring, but students lose a seat.</p>
      <div className="caps">
        {before.courses.map((c) => {
          const current = (program.cancellations ?? []).find((x) => x.courseId === c.courseId && x.term === term)?.sections ?? 0;
          return (
            <label key={c.courseId} className="cap-input">
              <span>
                <strong>{c.courseId}</strong> <span className="muted small">{c.sectionsNeeded} needed</span>
              </span>
              <input
                type="number"
                min={0}
                max={c.sectionsNeeded}
                value={cancel[c.courseId] ?? current}
                onChange={(e) => setCancel({ ...cancel, [c.courseId]: clampInt(e.target.value, 0, c.sectionsNeeded) })}
              />
            </label>
          );
        })}
        <button className="link" disabled={!changed} onClick={reset}>
          Reset to current staffing
        </button>
      </div>

      {changed && (
        <ul className="plan small">
          {changes.map((c, i) => (
            <li key={i}>{describeChange(program, c)}</li>
          ))}
        </ul>
      )}

      {onSaveEvidence && (
        <EvidenceBar
          changed={changed}
          allowUnchanged
          build={() => staffingPlanEvidence(program, changes, before, after)}
          onSave={onSaveEvidence}
        />
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
          <Row label="Unstaffed sections" a={before.unstaffedSections} b={after.unstaffedSections} fmt={String} lowerIsGood />
          <Row label="Sections offered" a={before.totalSections} b={after.totalSections} fmt={String} />
          <Row label="Students without a seat" a={before.totalSeatsUnserved} b={after.totalSeatsUnserved} fmt={String} lowerIsGood />
          <Row label="Program instruction cost" a={before.cost.program} b={after.cost.program} fmt={usd} lowerIsGood />
          <Row label="Budget balance" a={before.budgetBalance} b={after.budgetBalance} fmt={usd} />
          <tr>
            <th scope="row">Projected D/F/W</th>
            <td>{pct(before.dfw.mid)}</td>
            <td>{pct(after.dfw.mid)}</td>
            <td className={tone(diff.dfwMid, true)}>{diff.dfwMid === 0 ? "—" : `${signed(diff.dfwMid * 100, 1)} pts`}</td>
          </tr>
        </tbody>
      </table>

      <h3>Who teaches</h3>
      <div className="table-scroll">
        <table className="compare">
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Sections</th>
              <th scope="col">Of which overloads</th>
              <th scope="col">People without sections</th>
              <th scope="col">Cost</th>
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
                    {s.overloadCapacity > 0 || b.overloadCapacity > 0 ? `${s.overloadSections} of ${s.overloadCapacity}` : "—"}
                  </td>
                  <td>
                    {s.peopleWithoutSections}
                    <Delta value={s.peopleWithoutSections - b.peopleWithoutSections} higherIsBad />
                  </td>
                  <td>
                    {usd(s.cost)}
                    {s.paidBy === "department" && <span className="muted small"> (department)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="why" open>
        <summary>How these numbers were reached</summary>
        <ul>
          {after.trace.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

// ---------------------------------------------------------------------------

const RANK_CLASS: Record<Rank, string> = { tt: "seg-tt", ntt: "seg-ntt", gta: "seg-gta", adjunct: "seg-adjunct" };

/** Stacked bar: who teaches each offered section, plus any gap. */
function Coverage({ analysis }: { analysis: ReturnType<typeof analyzeTerm> }) {
  const total = analysis.totalSections;
  const parts = [
    ...analysis.staffing.flatMap((s) => [
      { key: s.rank, label: RANK_LABELS[s.rank], n: s.sectionsAssigned - s.overloadSections, cls: RANK_CLASS[s.rank] },
      { key: `${s.rank}-ol`, label: `${RANK_LABELS[s.rank]} (overload)`, n: s.overloadSections, cls: `${RANK_CLASS[s.rank]} seg-overload` },
    ]),
    { key: "gap", label: "Unstaffed", n: analysis.unstaffedSections, cls: "seg-gap" },
  ].filter((p) => p.n > 0);

  const summary =
    analysis.unstaffedSections > 0
      ? `${analysis.unstaffedSections} of ${total} sections ${analysis.unstaffedSections === 1 ? "has" : "have"} no instructor.`
      : `All ${total} sections are staffed.`;

  return (
    <div className="coverage">
      <p className={analysis.unstaffedSections > 0 ? "down" : ""}>
        <strong>{summary}</strong>
        {analysis.totalSectionsCancelled > 0 && (
          <span className="muted"> {analysis.totalSectionsCancelled} cancelled; {analysis.totalSeatsUnserved} students without a seat.</span>
        )}
      </p>
      <div className="coverage-bar" role="img" aria-label={`${summary} ${parts.map((p) => `${p.label}: ${p.n}`).join(", ")}.`}>
        {parts.map((p) => (
          <div key={p.key} className={`seg ${p.cls}`} style={{ flexGrow: p.n }} title={`${p.label}: ${p.n}`}>
            {p.n >= 3 ? p.n : ""}
          </div>
        ))}
      </div>
      <ul className="legend small">
        {parts.map((p) => (
          <li key={p.key}>
            <span className={`swatch ${p.cls}`} aria-hidden="true" /> {p.label} ({p.n})
          </li>
        ))}
      </ul>
    </div>
  );
}

function NumberField(props: { label: string; value: number; min?: number; max?: number; step?: number; wide?: boolean; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className={`num-input${props.wide ? " wide" : ""}`}
      aria-label={props.label}
      value={props.value}
      min={props.min}
      max={props.max}
      step={props.step ?? 1}
      onChange={(e) => props.onChange(clampInt(e.target.value, props.min ?? 0, props.max ?? Number.MAX_SAFE_INTEGER))}
    />
  );
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}
