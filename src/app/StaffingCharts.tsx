import { RANK_LABELS, rangeLabel, type Assumptions, type Rank, type StaffingLine, type TermAnalysis } from "../model";

/* Charts for the staffing planner and cap calculator. Every value is also in
   a table or in the row's own text, so the bars are never the only way to
   read a number. Rank colors come from --seg-* in styles.css. */

const RANK_VAR: Record<Rank, string> = {
  tt: "var(--seg-tt)",
  ntt: "var(--seg-ntt)",
  gta: "var(--seg-gta)",
  adjunct: "var(--seg-adjunct)",
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const share = (n: number, scale: number) => `${(n / scale) * 100}%`;

/**
 * Each group's capacity this term, filled in the order sections are assigned:
 * regular loads group by group, then overloads only once every regular load
 * is full. Shows where a gap lands and which group absorbs a change.
 */
export function CapacityChart({ before, after }: { before: TermAnalysis; after: TermAnalysis }) {
  const scale = Math.max(1, after.unstaffedSections, ...after.staffing.map((s) => s.capacity + s.overloadCapacity));

  return (
    <figure className="chart">
      <ol className="chart-rows">
        {after.staffing.map((s, i) => {
          const was = before.staffing.find((b) => b.rank === s.rank)?.sectionsAssigned ?? s.sectionsAssigned;
          const regular = s.sectionsAssigned - s.overloadSections;
          const available = s.capacity + s.overloadCapacity;
          return (
            <li key={s.rank} className="chart-row">
              <span className="chart-label">
                <span className="chart-order" aria-hidden="true">
                  {i + 1}
                </span>
                {RANK_LABELS[s.rank]}
              </span>
              <span className="chart-track" aria-hidden="true">
                <Seg n={regular} scale={scale} color={RANK_VAR[s.rank]} title={`${plural(regular, "regular section")}`} />
                <Seg n={s.capacity - regular} scale={scale} kind="unused" title={`${s.capacity - regular} unused`} />
                <Seg n={s.overloadSections} scale={scale} color={RANK_VAR[s.rank]} kind="overload" title={plural(s.overloadSections, "overload")} />
                <Seg
                  n={s.overloadCapacity - s.overloadSections}
                  scale={scale}
                  kind="unused-overload"
                  title={`${s.overloadCapacity - s.overloadSections} overloads unused`}
                />
                {was !== s.sectionsAssigned && (
                  <span className="was-tick" style={{ left: share(was, scale) }} title={`Currently ${was}`} />
                )}
              </span>
              <span className="chart-value">
                {s.sectionsAssigned} of {available}
                {was !== s.sectionsAssigned && <span className="muted"> (now {was})</span>}
              </span>
            </li>
          );
        })}
        {after.unstaffedSections > 0 && (
          <li className="chart-row gap-row">
            <span className="chart-label">Unstaffed</span>
            <span className="chart-track" aria-hidden="true">
              <Seg n={after.unstaffedSections} scale={scale} kind="gap" title={plural(after.unstaffedSections, "unstaffed section")} />
            </span>
            <span className="chart-value down">{plural(after.unstaffedSections, "section")}</span>
          </li>
        )}
      </ol>
      <figcaption className="small muted">
        Each bar is a group's teaching capacity this term, and the filled part is the sections it's assigned. Sections go
        to the groups in the order numbered, a full regular load at a time; overloads (striped) are used only after every
        regular load is full.
      </figcaption>
      <ul className="legend small" aria-hidden="true">
        <li>
          <span className="swatch key-assigned" /> Assigned
        </li>
        <li>
          <span className="swatch key-unused" /> Unused
        </li>
        <li>
          <span className="swatch key-overload" /> Overload
        </li>
        <li>
          <span className="swatch seg-gap" /> Unstaffed
        </li>
        <li>
          <span className="swatch key-was" /> Current, when you've made changes
        </li>
      </ul>
    </figure>
  );
}

function Seg({ n, scale, color, kind, title }: { n: number; scale: number; color?: string; kind?: string; title: string }) {
  if (n <= 0) return null;
  return <span className={`chart-seg ${kind ?? ""}`} style={{ width: share(n, scale), background: color }} title={title} />;
}

/**
 * What a full regular load means for one person in each group: students
 * taught against the recommended class size, and the feedback hours that
 * follow. Two charts, because students and hours don't share a scale.
 */
export function WorkloadChart({ before, after, assumptions }: { before: TermAnalysis; after: TermAnalysis; assumptions: Assumptions }) {
  const rows = after.staffing.filter((s) => s.headcount > 0 && s.sectionsPerTerm > 0);
  if (rows.length === 0) return null;
  const threshold = assumptions.classSizeThreshold;
  const feedback = assumptions.feedbackMinutesPerStudent;
  const recommended = (s: StaffingLine) => s.sectionsPerTerm * threshold.value;
  const prior = (s: StaffingLine) => before.staffing.find((b) => b.rank === s.rank);
  const avgSize = after.totalSections > 0 ? after.totalSeatsServed / after.totalSections : 0;

  const studentScale = Math.max(1, ...rows.map((s) => Math.max(s.studentsPerFullLoad, recommended(s)))) * 1.05;
  const hourScale = Math.max(1, ...rows.map((s) => s.feedbackHoursPerFullLoad.high)) * 1.05;
  const hours = (n: number) => String(Math.round(n));

  return (
    <figure className="chart workload">
      <div className="workload-grid">
        <div>
          <h4>Students per full load</h4>
          <ol className="chart-rows">
            {rows.map((s) => {
              const students = Math.round(s.studentsPerFullLoad);
              const max = recommended(s);
              const was = prior(s) && Math.round(prior(s)!.studentsPerFullLoad);
              return (
                <li key={s.rank} className="chart-row stacked">
                  <span className="chart-label">
                    {RANK_LABELS[s.rank]} <span className="muted small">· {plural(s.sectionsPerTerm, "section")}</span>
                  </span>
                  <span className="chart-track" aria-hidden="true">
                    <Seg n={s.studentsPerFullLoad} scale={studentScale} color={RANK_VAR[s.rank]} title={`${students} students`} />
                    <span className="ref-tick" style={{ left: share(max, studentScale) }} title={`Recommended maximum: ${max}`} />
                  </span>
                  <span className="chart-value">
                    {students} students
                    {students > max ? (
                      <span className="muted">, {students - max} over the recommended {max}</span>
                    ) : (
                      <span className="muted">, within the recommended {max}</span>
                    )}
                    {was !== undefined && was !== students && <span className="muted"> (now {was})</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <h4>Feedback hours per term</h4>
          <ol className="chart-rows">
            {rows.map((s) => {
              const r = s.feedbackHoursPerFullLoad;
              const was = prior(s) && Math.round(prior(s)!.feedbackHoursPerFullLoad.mid);
              return (
                <li key={s.rank} className="chart-row stacked">
                  <span className="chart-label">{RANK_LABELS[s.rank]}</span>
                  <span className="chart-track" aria-hidden="true">
                    <span
                      className="range-bar"
                      style={{ left: share(r.low, hourScale), width: share(r.high - r.low, hourScale), background: RANK_VAR[s.rank] }}
                      title={`${rangeLabel(r, hours)} hours`}
                    />
                    <span className="range-dot" style={{ left: share(r.mid, hourScale), background: RANK_VAR[s.rank] }} />
                  </span>
                  <span className="chart-value">
                    About {hours(r.mid)} hours <span className="muted">({rangeLabel(r, hours)})</span>
                    {was !== undefined && was !== Math.round(r.mid) && <span className="muted"> (now {was})</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <figcaption className="small muted">
        For one person teaching a full regular load at this term's average of {avgSize.toFixed(1)} students a section.
        Ticks mark the {threshold.label.toLowerCase()} ({threshold.value} students a section) times the load. Feedback
        assumes {feedback.value} minutes per student per term (range {feedback.low}–{feedback.high},{" "}
        <span className={`badge ${feedback.confidence}`}>{feedback.confidence}</span>); the bar spans the range and the dot
        marks the middle estimate.
      </figcaption>
    </figure>
  );
}
