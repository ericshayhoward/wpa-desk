import { useState } from "react";
import type { Term } from "../model";
import type { EvidenceDraft } from "../training";
import { signed } from "./format";

export function TermToggle({ term, onChange }: { term: Term; onChange: (t: Term) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Term">
      {(["fall", "spring"] as Term[]).map((t) => (
        <button key={t} aria-pressed={term === t} onClick={() => onChange(t)}>
          {t === "fall" ? "Fall" : "Spring"}
        </button>
      ))}
    </div>
  );
}

export function WhatIf({ what }: { what: string }) {
  return <p className="whatif small">What-if only: this doesn't change your program. {what} change through decisions.</p>;
}

/** "Save as evidence" bar shown when a tool is opened from a scenario. */
export function EvidenceBar({
  changed,
  build,
  onSave,
  allowUnchanged = false,
}: {
  changed: boolean;
  build: () => EvidenceDraft;
  onSave: (d: EvidenceDraft) => void;
  /** Let the current projection be saved as it stands (e.g., to show a term's numbers). */
  allowUnchanged?: boolean;
}) {
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="evidence-bar">
      <button
        className="primary"
        disabled={!changed && !allowUnchanged}
        onClick={() => {
          const draft = build();
          onSave(draft);
          setSaved(draft.label);
        }}
      >
        {changed || !allowUnchanged ? "Save this comparison as evidence" : "Save this projection as evidence"}
      </button>
      <span className="muted small" aria-live="polite">
        {saved
          ? `Saved: ${saved}`
          : changed
            ? "You can attach saved evidence to a memo."
            : allowUnchanged
              ? "Saves this term's numbers as they stand, or make a change to compare."
              : "Make a change to compare."}
      </span>
    </div>
  );
}

export function Row(props: { label: string; a: number; b: number; fmt: (n: number) => string; lowerIsGood?: boolean }) {
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

export function Delta({ value, higherIsBad }: { value: number; higherIsBad?: boolean }) {
  if (value === 0) return null;
  return <span className={`delta ${tone(value, higherIsBad)}`}>{signed(value)}</span>;
}

/** Colors a change by direction; whether up is good depends on the metric. */
export function tone(d: number, lowerIsGood = false): string {
  if (d === 0) return "";
  return (d > 0) !== lowerIsGood ? "up" : "down";
}
