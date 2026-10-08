import { useId, useRef, type ReactNode } from "react";
import {
  ASSUMPTION_IDS,
  COURSE_KINDS,
  COURSE_KIND_LABELS,
  DEFAULT_ASSUMPTIONS,
  RANK_LABELS,
  STAFFING_ORDER,
  capPath,
  type AssumptionId,
  type CourseKind,
  type FieldIssue,
  type InstructorPool,
  type LocalAssumption,
  type LocalAssumptions,
} from "../model";
import { newCourse, withPool, type CourseDraft, type ProgramDraft } from "./programDraft";
import { ConfirmButton } from "./ui";

/** Which problems to show beside their fields: those the person has left, or all of them once asked. */
export type Shown = Set<string> | "all";

interface Props {
  draft: ProgramDraft;
  onChange: (draft: ProgramDraft) => void;
  local: LocalAssumptions;
  onLocalChange: (local: LocalAssumptions) => void;
  programIssues: FieldIssue[];
  assumptionIssues: FieldIssue[];
  shown: Shown;
  onShow: (shown: Shown) => void;
  /** Whether a complete version exists for the tools to use (and to export). */
  hasComplete: boolean;
  saveError: string | null;
  onExport: () => void;
  onImport: (file: File) => void;
  onRemove: () => void;
}

/** The Program data view: everything the planning tools need to know about your program. */
export function ProgramData(props: Props) {
  const { draft, onChange, local, onLocalChange, programIssues, assumptionIssues, shown, onShow } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const issues = [...programIssues, ...assumptionIssues.map((i) => ({ ...i, path: `assumptions.${i.path}` }))];
  const visible = (path: string) => shown === "all" || shown.has(path);
  const errorAt = (path: string) => {
    const issue = issues.find((i) => i.path === path);
    return issue && visible(path) ? sentence(issue.problem) : undefined;
  };
  const leave = (path: string) => {
    if (shown !== "all" && !shown.has(path)) onShow(new Set([...shown, path]));
  };
  const hidden = issues.filter((i) => !visible(i.path)).length;
  const f = (path: string) => ({ error: errorAt(path), onBlur: () => leave(path) });

  const setCourse = (i: number, patch: Partial<CourseDraft>) =>
    onChange({ ...draft, courses: draft.courses.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const setPool = (i: number, patch: Partial<InstructorPool>) =>
    onChange({ ...draft, instructors: draft.instructors.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const missingRanks = STAFFING_ORDER.filter((r) => !draft.instructors.some((p) => p.rank === r));
  const setLocal = (id: AssumptionId, patch: Partial<LocalAssumption> | null) => {
    const next = { ...local };
    if (patch === null) delete next[id];
    else next[id] = { ...(local[id] ?? defaultsFor(id)), ...patch };
    onLocalChange(next);
  };

  return (
    <section className="tool program-data">
      <header className="tool-head">
        <div>
          <h2>Program data</h2>
          <p className="muted">Your program's courses, instructors, and budget. The planning tools use them as soon as they're complete.</p>
        </div>
      </header>

      <div className={`banner ${issues.length > 0 ? "note" : "good"}`} role="status">
        <p>
          {issues.length === 0
            ? "Complete, and saved in this browser. The planning tools use these numbers."
            : `${issues.length} ${issues.length === 1 ? "field needs" : "fields need"} attention. ${
                props.hasComplete
                  ? "Until then, the tools and this browser keep the last complete version."
                  : "The planning tools open once everything is filled in."
              }`}{" "}
          {hidden > 0 && (
            <button className="link" onClick={() => onShow("all")}>
              Show what's missing
            </button>
          )}
        </p>
      </div>
      {props.saveError && (
        <p className="banner bad" role="alert">
          {props.saveError}
        </p>
      )}

      <h3>Institution</h3>
      <div className="form-grid">
        <TextField label="Institution name" value={draft.institution} onChange={(v) => onChange({ ...draft, institution: v })} {...f("institution")} />
        <TextField
          label="Description (optional)"
          value={draft.description}
          onChange={(v) => onChange({ ...draft, description: v })}
          wide
          {...f("description")}
        />
        <NumField
          label="Instruction budget per term"
          hint="What the writing program pays instructors from, in dollars."
          prefix="$"
          value={draft.budgetPerTerm}
          onChange={(v) => onChange({ ...draft, budgetPerTerm: v })}
          {...f("budgetPerTerm")}
        />
      </div>

      <h3>Courses</h3>
      <p className="muted small">
        Seats needed are the students who need the course that term. The D/F/W rate is the share who earned a D, F, or W,
        with the average section size when you measured it: projections move it only as section sizes change from there.
      </p>
      {errorAt("courses") && <p className="field-error">{errorAt("courses")}</p>}
      {draft.courses.map((c, i) => {
        const at = `courses[${i}]`;
        const code = c.id.trim();
        return (
          <fieldset key={i} className="form-group">
            <legend>
              Course {i + 1}
              {code && `: ${code}`}
            </legend>
            <div className="form-grid">
              <TextField label="Course code" value={c.id} onChange={(v) => setCourse(i, { id: v })} {...f(`${at}.id`)} />
              <TextField label="Title" value={c.title} onChange={(v) => setCourse(i, { title: v })} {...f(`${at}.title`)} />
              <SelectField
                label="Kind"
                value={c.kind}
                options={COURSE_KINDS.map((k) => [k, COURSE_KIND_LABELS[k]])}
                onChange={(v) => setCourse(i, { kind: v as CourseKind })}
                {...f(`${at}.kind`)}
              />
              <NumField label="Credits" value={c.credits} onChange={(v) => setCourse(i, { credits: v })} {...f(`${at}.credits`)} />
              <NumField label="Fall seats needed" value={c.seatDemand.fall} onChange={(v) => setCourse(i, { seatDemand: { ...c.seatDemand, fall: v } })} {...f(`${at}.seatDemand.fall`)} />
              <NumField
                label="Spring seats needed"
                value={c.seatDemand.spring}
                onChange={(v) => setCourse(i, { seatDemand: { ...c.seatDemand, spring: v } })}
                {...f(`${at}.seatDemand.spring`)}
              />
              <NumField label="Cap per section" value={c.cap} onChange={(v) => setCourse(i, { cap: v })} {...(code ? f(capPath(code)) : {})} />
              <NumField
                label="D/F/W rate"
                suffix="%"
                value={Number.isFinite(c.baselineDfw) ? Number((c.baselineDfw * 100).toFixed(2)) : NaN}
                onChange={(v) => setCourse(i, { baselineDfw: v / 100 })}
                {...f(`${at}.baselineDfw`)}
              />
              <NumField
                label="Average section size then"
                hint="When that D/F/W rate was measured."
                value={c.baselineSectionSize}
                onChange={(v) => setCourse(i, { baselineSectionSize: v })}
                {...f(`${at}.baselineSectionSize`)}
              />
            </div>
            {draft.courses.length > 1 && (
              <button className="link" onClick={() => onChange({ ...draft, courses: draft.courses.filter((_, j) => j !== i) })}>
                Remove this course
              </button>
            )}
          </fieldset>
        );
      })}
      <button className="secondary" onClick={() => onChange({ ...draft, courses: [...draft.courses, newCourse()] })}>
        Add a course
      </button>

      <h3>Instructor groups</h3>
      <p className="muted small">
        Sections go to groups in this order, a full regular load at a time: tenure-track faculty, full-time non-tenure-track,
        graduate teaching assistants, then adjunct faculty. Overloads are used only after every regular load is full.
      </p>
      {draft.instructors.length === 0 && <p className="muted">No instructor groups yet.</p>}
      {draft.instructors.map((pool, i) => {
        const at = `instructors[${i}]`;
        const label = RANK_LABELS[pool.rank];
        const overloads = pool.overload?.maxPerPerson ?? 0;
        return (
          <fieldset key={pool.rank} className="form-group">
            <legend>{label}</legend>
            <div className="form-grid">
              <NumField label="People" value={pool.headcount} onChange={(v) => setPool(i, { headcount: v })} {...f(`${at}.headcount`)} />
              <NumField label="Sections each per term" value={pool.sectionsPerTerm} onChange={(v) => setPool(i, { sectionsPerTerm: v })} {...f(`${at}.sectionsPerTerm`)} />
              <NumField label="Pay per section" prefix="$" value={pool.costPerSection} onChange={(v) => setPool(i, { costPerSection: v })} {...f(`${at}.costPerSection`)} />
              <SelectField
                label="Paid by"
                value={pool.paidBy}
                options={[
                  ["program", "The writing program's budget"],
                  ["department", "The department (not the program)"],
                ]}
                onChange={(v) => setPool(i, { paidBy: v as InstructorPool["paidBy"] })}
                {...f(`${at}.paidBy`)}
              />
              <NumField
                label="Overloads per person"
                hint="Extra sections beyond a regular load; 0 for none."
                value={overloads}
                onChange={(v) => setPool(i, { overload: { maxPerPerson: v, costPerSection: pool.overload?.costPerSection ?? pool.costPerSection } })}
                {...f(`${at}.overload.maxPerPerson`)}
              />
              {overloads !== 0 && (
                <NumField
                  label="Overload pay per section"
                  prefix="$"
                  value={pool.overload?.costPerSection ?? NaN}
                  onChange={(v) => setPool(i, { overload: { maxPerPerson: overloads, costPerSection: v } })}
                  {...f(`${at}.overload.costPerSection`)}
                />
              )}
              <TextField
                label="Note (optional)"
                hint="Why the limits are what they are, e.g. a contract or benefits threshold."
                value={pool.note ?? ""}
                onChange={(v) => setPool(i, { note: v })}
                wide
                {...f(`${at}.note`)}
              />
            </div>
            <button className="link" onClick={() => onChange({ ...draft, instructors: draft.instructors.filter((_, j) => j !== i) })}>
              Remove this group
            </button>
          </fieldset>
        );
      })}
      {missingRanks.length > 0 && (
        <div className="row-start">
          {missingRanks.map((r) => (
            <button key={r} className="secondary" onClick={() => onChange(withPool(draft, r))}>
              Add {RANK_LABELS[r].toLowerCase()}
            </button>
          ))}
        </div>
      )}

      <h3>Assumptions</h3>
      <p className="muted small">
        How the projections connect class size to outcomes and workload. The defaults are illustrative or drawn from
        published statements; replace any with your own numbers, and they're marked as local data wherever they're used.
        Each needs a low and high end, so projections still show a range.
      </p>
      {ASSUMPTION_IDS.map((id) => {
        const def = DEFAULT_ASSUMPTIONS[id];
        const mine = local[id];
        const at = `assumptions.${id}`;
        return (
          <fieldset key={id} className="form-group">
            <legend>{def.label}</legend>
            <p className="muted small">
              Default: {def.value} {def.unit} (range {def.low}–{def.high}) <span className={`badge ${def.confidence}`}>{def.confidence}</span>
            </p>
            <div className="row-start">
              <label className="check">
                <input type="checkbox" checked={mine !== undefined} onChange={(e) => setLocal(id, e.target.checked ? {} : null)} />
                Use this program's own numbers
              </label>
              {mine && <span className="badge local-data">local-data</span>}
            </div>
            {mine && (
              <div className="form-grid">
                <NumField label="Value" suffix={def.unit} value={mine.value} onChange={(v) => setLocal(id, { value: v })} {...f(`${at}.value`)} />
                <NumField label="Low end" suffix={def.unit} value={mine.low} onChange={(v) => setLocal(id, { low: v })} {...f(`${at}.low`)} />
                <NumField label="High end" suffix={def.unit} value={mine.high} onChange={(v) => setLocal(id, { high: v })} {...f(`${at}.high`)} />
                <TextField
                  label="Source (optional)"
                  hint="Where these numbers come from, such as a local study."
                  value={mine.source ?? ""}
                  onChange={(v) => setLocal(id, { source: v })}
                  wide
                  {...f(`${at}.source`)}
                />
              </div>
            )}
          </fieldset>
        );
      })}

      <h3>File</h3>
      <p className="muted small">
        Your program is saved in this browser only, and nothing is sent anywhere. Browsers can clear saved data (Safari does
        after about a week away), so export a file to keep a copy, move it to another computer, or share it with a colleague.
        Importing a file replaces the program here.
      </p>
      <div className="row-start">
        <button className="secondary" disabled={!props.hasComplete} onClick={props.onExport}>
          Export program file
        </button>
        <label className="secondary file-button">
          Import program file
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) props.onImport(file);
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
        </label>
        <ConfirmButton label="Remove from this browser" confirm="Erase your program from this browser?" onConfirm={props.onRemove} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function defaultsFor(id: AssumptionId): LocalAssumption {
  const d = DEFAULT_ASSUMPTIONS[id];
  return { value: d.value, low: d.low, high: d.high };
}

function sentence(problem: string): string {
  return problem.charAt(0).toUpperCase() + problem.slice(1) + ".";
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  onBlur?: () => void;
  wide?: boolean;
}

/** A labelled field with its hint and error outside the label, so the field's name stays just the label. */
function FieldShell({ label, hint, error, wide, children }: FieldProps & { children: (ids: { input: string; describedBy?: string }) => ReactNode }) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`form-field${wide ? " wide" : ""}${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children({ input: id, describedBy })}
      {hint && (
        <span className="muted small" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}

function NumField({ value, onChange, prefix, suffix, ...rest }: FieldProps & { value: number; onChange: (v: number) => void; prefix?: string; suffix?: string }) {
  return (
    <FieldShell {...rest}>
      {({ input, describedBy }) => (
        <span className="input-affix">
          {prefix && <span aria-hidden="true">{prefix}</span>}
          <input
            id={input}
            type="number"
            step="any"
            value={Number.isFinite(value) ? value : ""}
            aria-invalid={rest.error ? true : undefined}
            aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
            onBlur={rest.onBlur}
          />
          {suffix && <span className="muted small">{suffix}</span>}
        </span>
      )}
    </FieldShell>
  );
}

function TextField({ value, onChange, ...rest }: FieldProps & { value: string; onChange: (v: string) => void }) {
  return (
    <FieldShell {...rest}>
      {({ input, describedBy }) => (
        <input
          id={input}
          type="text"
          value={value}
          aria-invalid={rest.error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={rest.onBlur}
        />
      )}
    </FieldShell>
  );
}

function SelectField({ value, options, onChange, ...rest }: FieldProps & { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <FieldShell {...rest}>
      {({ input, describedBy }) => (
        <select id={input} value={value} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} onBlur={rest.onBlur}>
          {options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
