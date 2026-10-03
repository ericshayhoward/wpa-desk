import { useRef, useState } from "react";
import { termLabel, type TrainingSession } from "../training";
import { SLOTS, deleteSlot, importFile, readSlot, writeSlot, type SlotId } from "./storage";

interface Props {
  session: TrainingSession;
  /** `fromFile` when the session came from a file, so it already has a copy outside the browser. */
  onLoad: (session: TrainingSession, note: string, fromFile?: boolean) => void;
  onNewSession: () => void;
  /** Downloads the session as a file and returns the file's name. */
  onExport: () => string;
}

export function SavesPanel({ session, onLoad, onNewSession, onExport }: Props) {
  // Bumped after writes so slot summaries re-read storage.
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const refresh = () => setVersion((v) => v + 1);

  const save = (slot: SlotId, n: number) => {
    const error = writeSlot(slot, session, `Save ${n}`);
    setMessage(error ? { kind: "error", text: error } : { kind: "ok", text: `Saved to slot ${n}.` });
    refresh();
  };

  const load = (slot: SlotId, n: number) => {
    const r = readSlot(slot);
    if (r.ok) onLoad(r.save.session, `Loaded slot ${n} (${r.save.summary.term}).`);
    else setMessage({ kind: "error", text: "error" in r ? r.error : "That slot is empty." });
  };

  const download = () => {
    const name = onExport();
    setMessage({ kind: "ok", text: `Exported ${name}.` });
  };

  const upload = async (file: File) => {
    try {
      const saveFile = importFile(await file.text());
      onLoad(saveFile.session, `Imported ${file.name} (${saveFile.summary.term}).`, true);
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <section className="tool saves" data-version={version}>
      <div className="tool-head">
        <div>
          <h2>Saves</h2>
          <p className="muted">
            Your session saves automatically in this browser, and slots keep separate playthroughs. Browsers can clear saved
            data, though (Safari does after about a week away), so export a file to keep a copy of your own, move a session to
            another computer, or hand it in.
          </p>
        </div>
      </div>

      {message && (
        <p className={`banner ${message.kind === "ok" ? "good" : "bad"}`} role="status">
          {message.text}
        </p>
      )}

      <p className="small">
        <strong>Current session:</strong> {session.program.institution}, {termLabel(session.termIndex)} ·{" "}
        {session.decisions.length} decision{session.decisions.length === 1 ? "" : "s"} · {session.dossier.length} memo
        {session.dossier.length === 1 ? "" : "s"}
      </p>

      <ul className="slots">
        {SLOTS.map((slot, i) => {
          const n = i + 1;
          const r = readSlot(slot);
          return (
            <li key={slot} className="slot">
              <div>
                <strong>Slot {n}</strong>
                <div className="small muted">
                  {r.ok
                    ? `${r.save.summary.term} · ${r.save.summary.decisions} decisions · ${r.save.summary.memos} memos · saved ${formatWhen(r.save.savedAt)}`
                    : "error" in r
                      ? `Unreadable: ${r.error}`
                      : "Empty"}
                </div>
              </div>
              <div className="slot-actions">
                {r.ok || "error" in r ? (
                  <ConfirmButton label="Save here" confirm={`Overwrite slot ${n}?`} onConfirm={() => save(slot, n)} />
                ) : (
                  <button className="secondary" onClick={() => save(slot, n)}>
                    Save here
                  </button>
                )}
                {r.ok && <ConfirmButton label="Load" confirm="Replace current session?" onConfirm={() => load(slot, n)} />}
                {(r.ok || "error" in r) && (
                  <ConfirmButton
                    label="Delete"
                    confirm={`Delete slot ${n}?`}
                    onConfirm={() => {
                      deleteSlot(slot);
                      setMessage({ kind: "ok", text: `Deleted slot ${n}.` });
                      refresh();
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <h3>Files</h3>
      <div className="row-start">
        <button className="secondary" onClick={download}>
          Export to file
        </button>
        <label className="secondary file-button">
          Import from file
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
      </div>

      <h3>Start over</h3>
      <p className="muted small">Begins a new session at Midland State. Save to a slot first if you want to keep this one.</p>
      <ConfirmButton label="Start a new session" confirm="Discard the current session?" onConfirm={onNewSession} />
    </section>
  );
}

/** Two-step button: the first click asks, the second acts. Avoids browser dialogs. */
function ConfirmButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className="secondary" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <span className="confirm">
      <span className="small">{confirm}</span>
      <button
        className="primary"
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        Yes
      </button>
      <button className="link" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "at an unknown time" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
