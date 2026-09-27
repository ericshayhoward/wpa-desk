import { useState } from "react";
import { REFLECTION_PROMPT } from "../training";

interface Props {
  scenarioTitle: string;
  saved: string | undefined;
  onSave: (text: string) => void;
}

/** Post-debrief reflection. Goes in the case file; never affects outcomes. */
export function ReflectionEditor({ scenarioTitle, saved, onSave }: Props) {
  const [draft, setDraft] = useState(saved ?? "");
  const dirty = draft.trim() !== (saved ?? "");
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  return (
    <div className="reflection">
      <label className="field no-print">
        <span>
          Reflection <span className="muted small">({words} words · for your case file, doesn't affect the game)</span>
        </span>
        <span className="muted small">{REFLECTION_PROMPT}</span>
        <textarea
          rows={5}
          value={draft}
          aria-label={`Reflection on ${scenarioTitle}`}
          onChange={(e) => setDraft(e.target.value)}
        />
      </label>
      <div className="row-start no-print">
        <button className="secondary" disabled={!dirty} onClick={() => onSave(draft)}>
          {saved ? "Update reflection" : "Save reflection"}
        </button>
        {!dirty && saved && <span className="muted small">Saved to your case file.</span>}
      </div>
      <div className="print-only">
        <p className="prewrap">{saved || "No reflection written."}</p>
      </div>
    </div>
  );
}
