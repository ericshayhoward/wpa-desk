import { useState } from "react";
import {
  DRAFT_REASON_LABELS,
  draftingMinutes,
  wordDiff,
  type DiffPart,
  type DraftVersion,
  type ReflectionVersion,
} from "../training";

/** Timeline of a memo's versions, with word-level changes between them. */
export function DraftHistory({ history, startedAt }: { history: DraftVersion[]; startedAt?: string }) {
  if (history.length === 0) {
    return <p className="muted small">No drafting history recorded (written before WPA Desk kept history).</p>;
  }
  const minutes = draftingMinutes(startedAt, history);
  return (
    <div className="history">
      <p className="small">
        {history.length} version{history.length === 1 ? "" : "s"}
        {minutes !== null && `; ${minutes} minute${minutes === 1 ? "" : "s"} from opening the memo to sending it`}.
      </p>
      <div className="table-scroll">
        <table className="compare history-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">When</th>
              <th scope="col">Event</th>
              <th scope="col">Words</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {history.map((v, i) => {
              const delta = i === 0 ? null : v.words - history[i - 1]!.words;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{when(v.at)}</td>
                  <td>{DRAFT_REASON_LABELS[v.reason]}</td>
                  <td>
                    {v.words}
                    {delta !== null && delta !== 0 && <span className="muted small"> ({delta > 0 ? `+${delta}` : `−${-delta}`})</span>}
                  </td>
                  <td className="small">{v.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {history.length > 1 && (
        <details className="why print-open">
          <summary>Changes between versions</summary>
          {history.slice(1).map((v, k) => {
            const prev = history[k]!;
            return (
              <div key={k} className="diff-step">
                <p className="small">
                  <strong>
                    Version {k + 2}: {DRAFT_REASON_LABELS[v.reason]}
                  </strong>{" "}
                  <span className="muted">{when(v.at)}</span>
                </p>
                {prev.subject !== v.subject && (
                  <p className="small">
                    Subject: <Diff parts={wordDiff(prev.subject, v.subject)} />
                  </p>
                )}
                {prev.ask !== v.ask && (
                  <p className="small">
                    Ask: <Diff parts={wordDiff(prev.ask, v.ask)} />
                  </p>
                )}
                {prev.body === v.body ? (
                  <p className="muted small">Body unchanged.</p>
                ) : (
                  <p className="diff-body">
                    <Diff parts={wordDiff(prev.body, v.body)} />
                  </p>
                )}
              </div>
            );
          })}
        </details>
      )}
    </div>
  );
}

export function ReflectionHistory({ history }: { history: ReflectionVersion[] }) {
  if (history.length < 2) return null;
  return (
    <details className="why print-open">
      <summary>Reflection history ({history.length} versions)</summary>
      {history.map((v, i) => (
        <div key={i} className="diff-step">
          <p className="small">
            <strong>Version {i + 1}</strong> <span className="muted">{when(v.at)} · {v.words} words</span>
          </p>
          <p className="diff-body">{i === 0 ? v.text : <Diff parts={wordDiff(history[i - 1]!.text, v.text)} />}</p>
        </div>
      ))}
    </details>
  );
}

/** Inline word diff: removed text struck through, added text highlighted. */
export function Diff({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "added" ? (
          <ins key={i}>{p.text}</ins>
        ) : (
          <del key={i}>{p.text}</del>
        ),
      )}
    </>
  );
}

/** Portfolio revision of a sent memo: the sent version stays as the reader received it. */
export function RevisionEditor({
  initial,
  onSave,
}: {
  initial: { subject: string; ask: string; body: string };
  onSave: (content: { subject: string; ask: string; body: string }, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [c, setC] = useState(initial);
  const [note, setNote] = useState("");
  if (!open) {
    return (
      <button className="secondary no-print" onClick={() => setOpen(true)}>
        Revise this memo for your portfolio
      </button>
    );
  }
  const changed = c.subject !== initial.subject || c.ask !== initial.ask || c.body !== initial.body;
  return (
    <div className="card no-print revision-editor">
      <p className="muted small">The version you sent stays on record; this revision is added to the history after it.</p>
      <label className="field">
        <span>Subject</span>
        <input value={c.subject} onChange={(e) => setC({ ...c, subject: e.target.value })} />
      </label>
      <label className="field">
        <span>The ask</span>
        <input value={c.ask} onChange={(e) => setC({ ...c, ask: e.target.value })} />
      </label>
      <label className="field">
        <span>Revised body</span>
        <textarea rows={8} value={c.body} onChange={(e) => setC({ ...c, body: e.target.value })} />
      </label>
      <label className="field">
        <span>Revision note: what did you change, and why?</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row-start">
        <button
          className="primary"
          disabled={!changed}
          onClick={() => {
            onSave({ subject: c.subject.trim(), ask: c.ask.trim(), body: c.body.trim() }, note);
            setOpen(false);
            setNote("");
          }}
        >
          Save revision
        </button>
        <button
          className="link"
          onClick={() => {
            setOpen(false);
            setC(initial);
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
