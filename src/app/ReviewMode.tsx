import { useMemo, useState } from "react";
import { SCENARIOS } from "../content";
import { scenarioSummaries, studentSummary, summariesToCsv, type SaveFile } from "../training";
import { Dossier } from "./Dossier";
import { importFile } from "./storage";
import { Icon } from "./ui";

interface Loaded {
  key: number;
  fileName: string;
  save?: SaveFile;
  error?: string;
}

type View = { kind: "overview" } | { kind: "scenarios" } | { kind: "student"; key: number };

/**
 * Instructor review. Student files are opened read-only and held in memory
 * only: nothing here writes to the instructor's own session or storage.
 */
export function ReviewMode({ onExit }: { onExit: () => void }) {
  const [files, setFiles] = useState<Loaded[]>([]);
  const [view, setView] = useState<View>({ kind: "overview" });
  const [dragging, setDragging] = useState(false);
  const [nextKey, setNextKey] = useState(1);

  const add = async (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const loaded = await Promise.all(
      incoming.map(async (f, i): Promise<Loaded> => {
        try {
          return { key: nextKey + i, fileName: f.name, save: importFile(await f.text()) };
        } catch (err) {
          return { key: nextKey + i, fileName: f.name, error: (err as Error).message };
        }
      }),
    );
    setNextKey((k) => k + incoming.length);
    setFiles((prev) => [...prev, ...loaded]);
  };

  const students = files.filter((f): f is Loaded & { save: SaveFile } => Boolean(f.save));
  const failed = files.filter((f) => f.error);
  const nameOf = (f: Loaded & { save: SaveFile }) => f.save.session.portfolio?.author || f.fileName.replace(/\.json$/i, "");
  const rows = useMemo(
    () => students.map((f) => ({ key: f.key, file: f.fileName, name: nameOf(f), summary: studentSummary(f.save.session) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files],
  );
  const byScenario = useMemo(
    () => scenarioSummaries(students.map((f) => ({ name: nameOf(f), session: f.save.session })), SCENARIOS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files],
  );

  const downloadCsv = () => {
    const url = URL.createObjectURL(new Blob([summariesToCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "wpa-desk-class-overview.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (view.kind === "student") {
    const f = students.find((s) => s.key === view.key);
    if (f) {
      return (
        <div className="review">
          <button className="link back-link no-print" onClick={() => setView({ kind: "overview" })}>
            <Icon name="back" size={16} />
            Back to class overview
          </button>
          <Dossier session={f.save.session} scenarios={SCENARIOS} title={`${nameOf(f)}: case files`} />
        </div>
      );
    }
  }

  return (
    <div className="review">
      <div className="tool-head">
        <div>
          <h2>Instructor review</h2>
          <p className="muted">
            Open student save files to review their work. Files are read-only and stay on this computer; nothing here
            changes your own session.
          </p>
        </div>
        <button className="secondary" onClick={onExit}>
          Back to my desk
        </button>
      </div>

      <label
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
      >
        <span className="icon-chip dropzone-icon" aria-hidden="true">
          <Icon name="folder" size={22} />
        </span>
        <strong>Open student files</strong>
        <span className="muted small">Drop save files (.json) here, or click to choose. You can select many at once.</span>
        <input
          type="file"
          multiple
          accept="application/json,.json"
          aria-label="Open student files"
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {failed.length > 0 && (
        <div className="banner bad" role="alert">
          {failed.map((f) => (
            <p key={f.key}>
              Couldn't open <strong>{f.fileName}</strong>: {f.error}
            </p>
          ))}
        </div>
      )}

      {students.length > 0 && (
        <>
          <div className="row-start review-bar">
            <div className="segmented" role="group" aria-label="Review view">
              <button aria-pressed={view.kind === "overview"} onClick={() => setView({ kind: "overview" })}>
                Class overview
              </button>
              <button aria-pressed={view.kind === "scenarios"} onClick={() => setView({ kind: "scenarios" })}>
                By scenario
              </button>
            </div>
            <button className="secondary" onClick={downloadCsv}>
              Download CSV
            </button>
            <button className="link" onClick={() => setFiles([])}>
              Close all files
            </button>
          </div>

          {view.kind === "overview" ? (
            <div className="table-scroll">
              <table className="compare review-table">
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Reached</th>
                    <th scope="col">Decisions</th>
                    <th scope="col">Memos</th>
                    <th scope="col">Memo words</th>
                    <th scope="col">Drafting min</th>
                    <th scope="col">Saved drafts</th>
                    <th scope="col">Revisions</th>
                    <th scope="col">Large insertions</th>
                    <th scope="col">Reflections</th>
                    <th scope="col">Commitments kept / missed / open</th>
                    <th scope="col"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">
                        {r.name}
                        {r.summary.course && <span className="pool-note">{r.summary.course}</span>}
                      </th>
                      <td>{r.summary.term}</td>
                      <td>{r.summary.decisions}</td>
                      <td>{r.summary.memos}</td>
                      <td>{r.summary.memoWords}</td>
                      <td>{r.summary.draftingMinutes}</td>
                      <td>{r.summary.savedDrafts}</td>
                      <td>{r.summary.portfolioRevisions}</td>
                      <td>{r.summary.largeInsertions}</td>
                      <td>
                        {r.summary.reflections} <span className="muted small">({r.summary.reflectionWords} words)</span>
                      </td>
                      <td>
                        {r.summary.commitmentsKept} / {r.summary.commitmentsMissed} / {r.summary.commitmentsOpen}
                      </td>
                      <td>
                        <button className="link" onClick={() => setView({ kind: "student", key: r.key })}>
                          Open case files
                        </button>
                        <button
                          className="link small"
                          aria-label={`Close ${r.file}`}
                          onClick={() => setFiles((fs) => fs.filter((f) => f.key !== r.key))}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            byScenario.map((s) => (
              <section key={s.scenario.id} className="card" aria-labelledby={`scn-${s.scenario.id}`}>
                <h3 id={`scn-${s.scenario.id}`}>{s.scenario.title}</h3>
                <p className="muted small">
                  {s.responded} of {students.length} responded · {s.memos} memo{s.memos === 1 ? "" : "s"} · {s.reflections}{" "}
                  reflection{s.reflections === 1 ? "" : "s"}
                </p>
                <ul className="choice-list">
                  {s.options.map((o) => (
                    <li key={o.id}>
                      <div className="choice-head">
                        <span>{o.label}</span>
                        <span className="num">
                          {o.count}
                          {o.persuaded !== null && o.count > 0 && <span className="muted small"> ({o.persuaded} persuaded)</span>}
                        </span>
                      </div>
                      <div className="choice-bar" aria-hidden="true">
                        <div style={{ width: `${s.responded ? (o.count / s.responded) * 100 : 0}%` }} />
                      </div>
                      {o.students.length > 0 && <p className="muted small">{o.students.join(", ")}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
