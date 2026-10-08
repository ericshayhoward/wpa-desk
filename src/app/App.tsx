import { useEffect, useState } from "react";
import { MIDLAND_STATE } from "../model";
import { SCENARIOS, STANDARD_ARC } from "../content";
import { startSession, type TrainingSession } from "../training";
import { Brand, Colophon, HomeButton, ThemeToggle } from "./Frame";
import { Game } from "./Game";
import { Planner } from "./Planner";
import { ReviewMode } from "./ReviewMode";
import { StartScreen } from "./StartScreen";
import { backupMark, writeBackup } from "./storage";

/**
 * Top-level screens. The game, the planning tools, and instructor review are
 * separate: leaving one for another never changes the others' state.
 */
type Screen =
  | { kind: "home" }
  | { kind: "game"; session: TrainingSession; note: string | null }
  | { kind: "plan" }
  | { kind: "review" };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const home = () => setScreen({ kind: "home" });

  useEffect(() => {
    document.scrollingElement?.scrollTo?.({ top: 0 });
  }, [screen.kind]);

  if (screen.kind === "game") {
    return <Game initial={screen.session} initialNote={screen.note} onHome={home} />;
  }

  if (screen.kind === "plan") {
    return <Planner onHome={home} />;
  }

  if (screen.kind === "review") {
    return (
      <div className="app">
        <header className="masthead no-print">
          <div className="masthead-inner">
            <div className="masthead-row">
              <Brand sub="Instructor review" />
              <div className="masthead-actions">
                <HomeButton onHome={home} />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
        <main className="page view">
          <ReviewMode />
        </main>
        <Colophon />
      </div>
    );
  }

  return (
    <div className="app">
      <StartScreen
        onResume={(session) => setScreen({ kind: "game", session, note: null })}
        onNewGame={() => {
          // A new game has no copy outside the browser yet.
          writeBackup(null);
          setScreen({ kind: "game", session: startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), note: null });
        }}
        onOpenFile={(session, note) => {
          // A session from a file already has a copy outside the browser.
          writeBackup(backupMark(session, new Date()));
          setScreen({ kind: "game", session, note });
        }}
        onPlan={() => setScreen({ kind: "plan" })}
        onReview={() => setScreen({ kind: "review" })}
      />
      <Colophon />
    </div>
  );
}
