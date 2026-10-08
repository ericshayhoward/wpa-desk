import { useRef, useState } from "react";
import { STAGE_LABELS, type TrainingSession } from "../training";
import { ThemeToggle } from "./Frame";
import { AUTOSAVE, importFile, readSlot } from "./storage";
import { Icon, Logo } from "./ui";

const GUIDE = "https://ericshayhoward.com/projects/wpa-desk/teaching/";

interface Props {
  /** Continue the autosaved game. */
  onResume: (session: TrainingSession) => void;
  onNewGame: () => void;
  /** A game opened from a save file, with a note saying which. */
  onOpenFile: (session: TrainingSession, note: string) => void;
  onPlan: () => void;
  onReview: () => void;
}

/** The front door: play the game, use the planning tools, or review students' work. */
export function StartScreen({ onResume, onNewGame, onOpenFile, onPlan, onReview }: Props) {
  // Read once: the autosave doesn't change while this screen is open.
  const [autosave] = useState(() => readSlot(AUTOSAVE));
  const [confirming, setConfirming] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const open = async (file: File) => {
    try {
      const save = importFile(await file.text());
      onOpenFile(save.session, `Opened ${file.name} (${save.summary.term}).`);
    } catch (err) {
      setFileError((err as Error).message);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <>
      <header className="masthead home-hero">
        <div className="masthead-inner">
          <div className="home-top">
            <ThemeToggle />
          </div>
          <div className="home-brand">
            <Logo size={56} />
            <div>
              <h1>WPA Desk</h1>
              <p className="home-tagline">Practice running a writing program, or plan one.</p>
            </div>
          </div>
        </div>
      </header>

      <main className="page home view">
        <div className="paths">
          <section className="card path" aria-labelledby="path-play">
            <h2 id="path-play" className="card-title">
              <span className="icon-chip" aria-hidden="true">
                <Icon name="play" size={16} />
              </span>
              Play
            </h2>
            <p className="muted">
              Three years as assistant director of first-year writing at a fictional university: staff sections, answer
              the dean, write memos, and live with the consequences.
            </p>

            {autosave.ok && (
              <div className="resume">
                <button className="primary" onClick={() => onResume(autosave.save.session)}>
                  Resume
                </button>
                <p className="small muted">
                  {autosave.save.summary.term} · {STAGE_LABELS[autosave.save.session.stage]} ·{" "}
                  {autosave.save.summary.decisions} decision{autosave.save.summary.decisions === 1 ? "" : "s"}
                </p>
              </div>
            )}
            {"error" in autosave && (
              <p className="banner bad small" role="alert">
                Couldn't resume your last game ({autosave.error}). Start a new game or open a save file.
              </p>
            )}

            {confirming ? (
              <div className="confirm-block" role="group" aria-label="Start a new game">
                <p className="small">
                  A new game replaces the one saved in this browser. To keep it, resume and save it to a slot or export
                  it first.
                </p>
                <div className="row-start">
                  <button className="primary" onClick={onNewGame}>
                    Start a new game
                  </button>
                  <button className="link" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="row-start">
                <button
                  className={autosave.ok ? "secondary" : "primary"}
                  onClick={() => (autosave.ok ? setConfirming(true) : onNewGame())}
                >
                  New game
                </button>
                <label className="secondary file-button">
                  Open a save file
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void open(f);
                    }}
                  />
                </label>
              </div>
            )}
            {fileError && (
              <p className="banner bad small" role="alert">
                {fileError}
              </p>
            )}
          </section>

          <section className="card path" aria-labelledby="path-plan">
            <h2 id="path-plan" className="card-title">
              <span className="icon-chip" aria-hidden="true">
                <Icon name="chart" size={16} />
              </span>
              Plan
            </h2>
            <p className="muted">
              The staffing planner and class cap calculator on their own, without the game: who teaches every section,
              what it costs, and how much feedback each instructor carries.
            </p>
            <div className="row-start">
              <button className="secondary" onClick={onPlan}>
                Open planning tools
              </button>
            </div>
            <p className="small muted">Use the game's sample program, or enter your own program's numbers.</p>
          </section>

          <section className="card path" aria-labelledby="path-teach">
            <h2 id="path-teach" className="card-title">
              <span className="icon-chip" aria-hidden="true">
                <Icon name="cap" size={16} />
              </span>
              Teach
            </h2>
            <p className="muted">
              Open students' save files read-only to see how the class decided, what they wrote, and how they drafted.
            </p>
            <div className="row-start">
              <button className="secondary" onClick={onReview}>
                Instructor review
              </button>
            </div>
            <p className="small">
              <a href={GUIDE}>Guide for instructors</a>
            </p>
          </section>
        </div>

        <p className="storage-note">
          <Icon name="save" size={16} />
          <span>Everything stays in this browser; nothing you enter is sent anywhere.</span>
        </p>
      </main>
    </>
  );
}
