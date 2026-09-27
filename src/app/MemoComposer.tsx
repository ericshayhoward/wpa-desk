import { useState } from "react";
import type { StakeholderId } from "../model";
import {
  SELF_ASSESSMENT,
  type MemoDraft,
  type ScenarioOption,
  type SelfAssessmentId,
  type TrainingSession,
} from "../training";
import { stakeholderName } from "./format";

interface Props {
  session: TrainingSession;
  option: ScenarioOption;
  audience: StakeholderId;
  prompt: string;
  defaultSubject: string;
  onCancel: () => void;
  onSend: (memo: MemoDraft) => void;
}

export function MemoComposer({ session, option, audience, prompt, defaultSubject, onCancel, onSend }: Props) {
  const [subject, setSubject] = useState(defaultSubject);
  const [ask, setAsk] = useState("");
  const [body, setBody] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [commitments, setCommitments] = useState<{ text: string; dueInTerms: number }[]>([]);
  const [check, setCheck] = useState<Partial<Record<SelfAssessmentId, boolean>>>({});

  const words = body.trim() ? body.trim().split(/\s+/).length : 0;
  const ready = subject.trim() !== "" && ask.trim() !== "" && words > 0;
  const toggleEvidence = (id: string) =>
    setEvidenceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const quote = (lines: string[]) => setBody((b) => `${b.trimEnd()}${b.trim() ? "\n\n" : ""}${lines.join("\n")}`);

  return (
    <section className="card memo">
      <h3>Memo to {stakeholderName(session.program, audience)}</h3>
      <p className="muted">{prompt}</p>
      <p className="small">
        Decision: <strong>{option.label}</strong>
      </p>

      <label className="field">
        <span>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>

      <label className="field">
        <span>The ask, in one sentence</span>
        <input
          value={ask}
          placeholder="What do you want this reader to do or agree to?"
          onChange={(e) => setAsk(e.target.value)}
        />
      </label>

      <label className="field">
        <span>
          Body <span className="muted small">({words} words)</span>
        </span>
        <textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>

      <fieldset className="field">
        <legend>Evidence</legend>
        {session.evidence.length === 0 ? (
          <p className="muted small">
            No saved evidence yet. Open a tool above, run the numbers, and save the result to attach it here.
          </p>
        ) : (
          session.evidence.map((e) => (
            <div key={e.id} className="evidence">
              <label>
                <input type="checkbox" checked={evidenceIds.includes(e.id)} onChange={() => toggleEvidence(e.id)} />{" "}
                <strong>{e.label}</strong>
              </label>
              <ul className="small">
                {e.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
              <button className="link small" onClick={() => quote(e.summary)}>
                Quote in body
              </button>
            </div>
          ))
        )}
      </fieldset>

      <fieldset className="field">
        <legend>Commitments</legend>
        <p className="muted small">Promises you make here are tracked. Keeping them builds trust; missing them costs it.</p>
        {commitments.map((c, i) => (
          <div key={i} className="commitment">
            <input
              value={c.text}
              placeholder="e.g., Share D/F/W data by next fall"
              aria-label={`Commitment ${i + 1}`}
              onChange={(e) => setCommitments(commitments.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
            <select
              value={c.dueInTerms}
              aria-label={`Commitment ${i + 1} due`}
              onChange={(e) =>
                setCommitments(commitments.map((x, j) => (j === i ? { ...x, dueInTerms: Number(e.target.value) } : x)))
              }
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  in {n} term{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <button className="link small" onClick={() => setCommitments(commitments.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button className="link" onClick={() => setCommitments([...commitments, { text: "", dueInTerms: 2 }])}>
          + Add a commitment
        </button>
      </fieldset>

      <fieldset className="field">
        <legend>Before you send</legend>
        <p className="muted small">For your own reflection. This doesn't affect the outcome.</p>
        {SELF_ASSESSMENT.map((item) => (
          <label key={item.id} className="check">
            <input
              type="checkbox"
              checked={Boolean(check[item.id])}
              onChange={(e) => setCheck({ ...check, [item.id]: e.target.checked })}
            />{" "}
            {item.label}
          </label>
        ))}
      </fieldset>

      <div className="row-end">
        <button className="secondary" onClick={onCancel}>
          Back to options
        </button>
        <button
          className="primary"
          disabled={!ready}
          onClick={() =>
            onSend({
              audience,
              subject: subject.trim(),
              ask: ask.trim(),
              body: body.trim(),
              evidenceIds,
              commitments: commitments.filter((c) => c.text.trim()),
              selfAssessment: check,
            })
          }
        >
          Send memo and decide
        </button>
      </div>
      {!ready && <p className="muted small row-end-note">A subject, an ask, and a body are needed to send.</p>}
    </section>
  );
}
