import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_ASSUMPTIONS,
  MIDLAND_STATE,
  checkLocalAssumptions,
  checkProgram,
  withLocalAssumptions,
  type LocalAssumptions,
  type Program,
} from "../model";
import { CapCalculator } from "./CapCalculator";
import { Brand, Colophon, HomeButton, ThemeToggle } from "./Frame";
import { ProgramData, type Shown } from "./ProgramData";
import { blankDraft, copyOfSample, fromDraft, toDraft, type ProgramDraft } from "./programDraft";
import { StaffingPlanner } from "./StaffingPlanner";
import {
  deleteWorkingProgram,
  downloadProgram,
  importProgramFile,
  readWorkingProgram,
  requestPersistence,
  writeWorkingProgram,
} from "./storage";
import { Icon, type IconName } from "./ui";

type Tool = "staffing" | "caps" | "data";
type Which = "sample" | "yours";

const TOOL_LABELS: Record<Tool, string> = { staffing: "Staffing planner", caps: "Class cap calculator", data: "Program data" };
const TOOL_ICONS: Record<Tool, IconName> = { staffing: "users", caps: "sliders", data: "folder" };

/** The last complete version of your program: what the tools run on and what's saved. */
interface Complete {
  program: Program;
  assumptions: LocalAssumptions;
}

/**
 * The planning tools outside the game: the same tools the game uses, with no
 * session, scenarios, or game stats, on the sample program or on your own.
 * Your program saves in this browser as you edit; the game never sees it.
 */
export function Planner({ onHome }: { onHome: () => void }) {
  // Read once: nothing else writes the working program while this screen is open.
  const [stored] = useState(readWorkingProgram);
  const [which, setWhich] = useState<Which>(stored.ok ? "yours" : "sample");
  const [tool, setTool] = useState<Tool>("staffing");
  const [draft, setDraft] = useState<ProgramDraft | null>(stored.ok ? toDraft(stored.file.program) : null);
  const [local, setLocal] = useState<LocalAssumptions>(stored.ok ? stored.file.assumptions : {});
  const [complete, setComplete] = useState<Complete | null>(
    stored.ok ? { program: stored.file.program, assumptions: stored.file.assumptions } : null,
  );
  const [shown, setShown] = useState<Shown>("all");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "good" | "bad"; text: string } | null>(
    "error" in stored ? { kind: "bad", text: `The program saved in this browser couldn't be opened: ${stored.error}` } : null,
  );

  const checked = useMemo(
    () => (draft ? { program: checkProgram(fromDraft(draft)), local: checkLocalAssumptions(local) } : null),
    [draft, local],
  );

  // Each complete version replaces the last, in the tools and in this browser.
  useEffect(() => {
    if (!checked?.program.ok || !checked.local.ok) return;
    const next = { program: checked.program.value, assumptions: checked.local.value };
    setComplete(next);
    setSaveError(writeWorkingProgram(next.program, next.assumptions));
  }, [checked]);

  const yours = which === "yours";
  const current = yours ? (complete?.program ?? null) : MIDLAND_STATE;
  const assumptions = useMemo(
    () => (yours && complete ? withLocalAssumptions(DEFAULT_ASSUMPTIONS, complete.assumptions) : DEFAULT_ASSUMPTIONS),
    [yours, complete],
  );
  const shownTool: Tool = !yours && tool === "data" ? "staffing" : tool;

  const start = (next: ProgramDraft, nextLocal: LocalAssumptions, note: string | null, reveal: Shown) => {
    setDraft(next);
    setLocal(nextLocal);
    setShown(reveal);
    setMessage(note ? { kind: "good", text: note } : null);
    setTool("data");
    // Real program data is worth asking the browser to keep.
    requestPersistence();
  };

  const importFile = async (file: File) => {
    try {
      const f = importProgramFile(await file.text());
      start(toDraft(f.program), f.assumptions, `Imported ${file.name}.`, "all");
    } catch (err) {
      setMessage({ kind: "bad", text: (err as Error).message });
    }
  };

  const remove = () => {
    deleteWorkingProgram();
    setDraft(null);
    setLocal({});
    setComplete(null);
    setTool("staffing");
    setMessage({ kind: "good", text: "Removed your program from this browser." });
  };

  const institution = yours ? draft?.institution.trim() || complete?.program.institution || "Your program" : MIDLAND_STATE.institution;
  const description = yours ? (draft?.description ?? "") : MIDLAND_STATE.description;
  const tools: Tool[] = yours && draft ? ["staffing", "caps", "data"] : ["staffing", "caps"];
  const issueCount = checked ? (checked.program.ok ? 0 : checked.program.issues.length) + (checked.local.ok ? 0 : checked.local.issues.length) : 0;

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-row">
            <Brand sub="Planning tools" />
            <div className="masthead-actions">
              <nav className="tabs" aria-label="Tools">
                {tools.map((t) => (
                  <button key={t} aria-current={shownTool === t ? "page" : undefined} onClick={() => setTool(t)}>
                    <Icon name={TOOL_ICONS[t]} size={16} />
                    {TOOL_LABELS[t]}
                  </button>
                ))}
              </nav>
              <HomeButton onHome={onHome} />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <div className="page">
        <section className="program-card" aria-label="Program">
          <div className="segmented program-picker" role="group" aria-label="Program to plan">
            <button aria-pressed={!yours} onClick={() => setWhich("sample")}>
              Midland State (sample)
            </button>
            <button aria-pressed={yours} onClick={() => setWhich("yours")}>
              Your program
            </button>
          </div>
          <p>
            <strong>{institution}</strong>
            {!yours && <span className="badge illustrative">sample program</span>}
          </p>
          {description && <p className="muted small">{description}</p>}
        </section>

        {yours && message && (
          <p className={`banner ${message.kind}`} role="status">
            {message.text}
          </p>
        )}

        <main key={`${shownTool}-${which}`} className="view">
          {yours && !draft ? (
            <StartYours
              onCopy={() => start(copyOfSample(), {}, null, "all")}
              onBlank={() => start(blankDraft(), {}, null, new Set())}
              onImport={importFile}
            />
          ) : shownTool === "data" && draft ? (
            <ProgramData
              draft={draft}
              onChange={setDraft}
              local={local}
              onLocalChange={setLocal}
              programIssues={checked && !checked.program.ok ? checked.program.issues : []}
              assumptionIssues={checked && !checked.local.ok ? checked.local.issues : []}
              shown={shown}
              onShow={setShown}
              hasComplete={complete !== null}
              saveError={saveError}
              onExport={() => {
                if (!complete) return;
                const name = downloadProgram(complete.program, complete.assumptions);
                setMessage({ kind: "good", text: `Exported ${name}.` });
              }}
              onImport={importFile}
              onRemove={remove}
            />
          ) : current ? (
            <>
              {yours && issueCount > 0 && (
                <p className="banner note" role="note">
                  Program data has {issueCount} {issueCount === 1 ? "field" : "fields"} still to fix, so these numbers come
                  from the last complete version.
                </p>
              )}
              {shownTool === "staffing" ? (
                <StaffingPlanner program={current} planning assumptions={assumptions} />
              ) : (
                <CapCalculator program={current} planning assumptions={assumptions} />
              )}
            </>
          ) : (
            <section className="tool">
              <h2>{TOOL_LABELS[shownTool]}</h2>
              <p>The tools open once your program's data is complete.</p>
              <button className="primary" onClick={() => setTool("data")}>
                Finish your program data
              </button>
            </section>
          )}
        </main>
      </div>
      <Colophon />
    </div>
  );
}

/** Choosing how to begin your own program. */
function StartYours({ onCopy, onBlank, onImport }: { onCopy: () => void; onBlank: () => void; onImport: (file: File) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section className="tool">
      <h2>Your program</h2>
      <p>
        Enter your program's courses, seats, caps, instructors, pay, and budget, and the planning tools run on them. It's
        saved in this browser only, and nothing is sent anywhere; export a file to keep a copy.
      </p>
      <div className="row-start">
        <button className="primary" onClick={onCopy}>
          Start from a copy of the sample
        </button>
        <button className="secondary" onClick={onBlank}>
          Start blank
        </button>
        <label className="secondary file-button">
          Import a program file
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              if (fileInput.current) fileInput.current.value = "";
            }}
          />
        </label>
      </div>
    </section>
  );
}
