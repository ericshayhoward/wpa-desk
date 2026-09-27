import { useEffect, useRef, useState } from "react";
import type { StakeholderId } from "../model";
import {
  COMMITMENT_EFFECTS,
  EFFORT_CHOICES,
  HISTORY_NOTICE,
  SELF_ASSESSMENT,
  SNAPSHOT_RULES,
  snapshot,
  wordCount,
  type DraftInProgress,
  type DraftReason,
  type DraftVersion,
  type MemoDraft,
  type ScenarioOption,
  type SelfAssessmentId,
  type TrainingSession,
} from "../training";
import { CAST } from "../content";
import { characterFor, persuasionProfile } from "../training";
import { stakeholderByline } from "./format";

interface Props {
  session: TrainingSession;
  option: ScenarioOption;
  audience: StakeholderId;
  prompt: string;
  defaultSubject: string;
  /** An unsent draft to resume, if the writer started one earlier. */
  resume?: DraftInProgress;
  /** Called on every change so the draft survives reloads. */
  onDraft: (draft: DraftInProgress) => void;
  onCancel: () => void;
  onSend: (memo: MemoDraft) => void;
}

export function MemoComposer({ session, option, audience, prompt, defaultSubject, resume, onDraft, onCancel, onSend }: Props) {
  const d = resume?.draft;
  const [subject, setSubject] = useState(d?.subject ?? defaultSubject);
  const [ask, setAsk] = useState(d?.ask ?? "");
  const [body, setBody] = useState(d?.body ?? "");
  const [evidenceIds, setEvidenceIds] = useState<string[]>(d?.evidenceIds ?? []);
  const [commitments, setCommitments] = useState<{ text: string; dueInTerms: number; effortHours: number }[]>(d?.commitments ?? []);
  const [check, setCheck] = useState<Partial<Record<SelfAssessmentId, boolean>>>(d?.selfAssessment ?? {});
  const [history, setHistory] = useState<DraftVersion[]>(resume?.history ?? []);
  const [startedAt] = useState(() => resume?.startedAt ?? new Date().toISOString());
  const [draftNote, setDraftNote] = useState("");

  const words = wordCount(body);
  const ready = subject.trim() !== "" && ask.trim() !== "" && words > 0;
  const toggleEvidence = (id: string) =>
    setEvidenceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const content = { subject, ask, body };
  const record = (reason: DraftReason, c = content, note?: string) =>
    setHistory((h) => snapshot(h, c, reason, new Date(), note));

  const quote = (lines: string[]) => {
    const next = `${body.trimEnd()}${body.trim() ? "\n\n" : ""}${lines.join("\n")}`;
    setBody(next);
    record("quoted-evidence", { subject, ask, body: next });
  };

  const changeBody = (next: string) => {
    if (wordCount(next) - wordCount(body) >= SNAPSHOT_RULES.largeChangeWords) record("large-change", { subject, ask, body: next });
    setBody(next);
  };

  // Snapshot after a pause in writing.
  useEffect(() => {
    const t = setTimeout(() => record("pause"), SNAPSHOT_RULES.pauseMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, ask, body]);

  // Keep the draft in the session so it survives reloads.
  const onDraftRef = useRef(onDraft);
  onDraftRef.current = onDraft;
  useEffect(() => {
    onDraftRef.current({
      optionId: option.id,
      startedAt,
      history,
      draft: { audience, subject, ask, body, evidenceIds, commitments, selfAssessment: check },
    });
  }, [option.id, startedAt, history, audience, subject, ask, body, evidenceIds, commitments, check]);

  return (
    <section className="card memo">
      <h3>Memo to {stakeholderByline(session.program, audience)}</h3>
      <p className="muted">{prompt}</p>
      <ReaderNote session={session} audience={audience} persuades={Boolean(option.persuasion)} />
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
        <textarea rows={10} value={body} onChange={(e) => changeBody(e.target.value)} />
      </label>

      <div className="draft-bar">
        <input
          className="draft-note"
          value={draftNote}
          placeholder="Revision note (optional): what did you change, and why?"
          aria-label="Revision note"
          onChange={(e) => setDraftNote(e.target.value)}
        />
        <button
          className="secondary"
          onClick={() => {
            record("draft", content, draftNote);
            setDraftNote("");
          }}
        >
          Save draft
        </button>
      </div>
      <p className="muted small history-status" aria-live="polite">
        {history.length === 0
          ? "No versions saved yet."
          : `${history.length} version${history.length === 1 ? "" : "s"} saved · last ${new Date(history[history.length - 1]!.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}{" "}
        · {HISTORY_NOTICE}
      </p>

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
        <p className="muted small">
          Promises you make here are tracked. Delivering one takes admin hours in the term you do it; keeping it earns trust (+
          {COMMITMENT_EFFECTS.keptTrust}) and political capital (+{COMMITMENT_EFFECTS.keptCapital}), and missing it costs more (
          {COMMITMENT_EFFECTS.missedTrust}).
        </p>
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
            <select
              value={c.effortHours}
              aria-label={`Commitment ${i + 1} effort`}
              onChange={(e) =>
                setCommitments(commitments.map((x, j) => (j === i ? { ...x, effortHours: Number(e.target.value) } : x)))
              }
            >
              {EFFORT_CHOICES.map((h) => (
                <option key={h} value={h}>
                  {h} admin hours
                </option>
              ))}
            </select>
            <button className="link small" onClick={() => setCommitments(commitments.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button className="link" onClick={() => setCommitments([...commitments, { text: "", dueInTerms: 2, effortHours: 4 }])}>
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
          onClick={() => {
            const final = { subject: subject.trim(), ask: ask.trim(), body: body.trim() };
            onSend({
              audience,
              ...final,
              evidenceIds,
              commitments: commitments.filter((c) => c.text.trim()),
              selfAssessment: check,
              history: snapshot(history, final, "sent", new Date()),
              startedAt,
            });
          }}
        >
          Send memo and decide
        </button>
      </div>
      {!ready && <p className="muted small row-end-note">A subject, an ask, and a body are needed to send.</p>}
    </section>
  );
}

/** Who you're writing to: what moves them, and where the relationship stands. */
function ReaderNote({ session, audience, persuades }: { session: TrainingSession; audience: StakeholderId; persuades: boolean }) {
  const c = characterFor(CAST, audience);
  const trust = session.program.stakeholders.find((s) => s.id === audience)?.trust ?? 0;
  const p = persuasionProfile(CAST, audience);
  const who = c?.shortName ?? "This reader";
  return (
    <div className="reader-note small">
      {c && (
        <p>
          <strong>{c.shortName} responds to:</strong> {c.responds}
        </p>
      )}
      {persuades && (
        <p className="muted">
          Trust now: {trust}. With the evidence {who} needs, {p.withEvidence} is enough
          {trust >= p.withEvidence ? " ✓" : ""}. Without it, you'd need {p.withoutEvidence}
          {trust >= p.withoutEvidence ? " ✓" : ""}.
        </p>
      )}
    </div>
  );
}
