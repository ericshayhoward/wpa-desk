import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ASSUMPTIONS, MIDLAND_STATE, analyzeTerm } from "../model";
import { SCENARIOS } from "../content";
import {
  addEvidence,
  advanceTerm,
  resolveScenario,
  startSession,
  termLabel,
  termOf,
  type DecisionOutcome,
  type EvidenceDraft,
  type MemoDraft,
  type PendingEffect,
  type TrainingSession,
} from "../training";
import { CapCalculator } from "./CapCalculator";
import { Desk } from "./Desk";
import { Dossier } from "./Dossier";
import { OutcomeView } from "./OutcomeView";
import { ScenarioView } from "./ScenarioView";
import { SavesPanel } from "./SavesPanel";
import { StaffingPlanner } from "./StaffingPlanner";
import { usd } from "./format";
import { AUTOSAVE, readSlot, writeSlot } from "./storage";

type Tab = "desk" | "dossier" | "tools" | "saves";

const TAB_LABELS: Record<Tab, string> = { desk: "Desk", dossier: "Dossier", tools: "Tools", saves: "Saves" };

/** Resume from the autosave if there is a readable one; otherwise start fresh. */
function initialSession(): { session: TrainingSession; note: string | null } {
  const r = readSlot(AUTOSAVE);
  if (r.ok) return { session: r.save.session, note: `Resumed your session (${r.save.summary.term}).` };
  const fresh = startSession(MIDLAND_STATE, SCENARIOS);
  if ("error" in r) return { session: fresh, note: `Couldn't resume your last session (${r.error}). Started a new one.` };
  return { session: fresh, note: null };
}
type Tool = "caps" | "staffing";

export function App() {
  const [initial] = useState(initialSession);
  const [session, setSession] = useState(initial.session);
  const [note, setNote] = useState<string | null>(initial.note);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("desk");
  const [tool, setTool] = useState<Tool>("caps");
  const [openScenario, setOpenScenario] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [landed, setLanded] = useState<PendingEffect[]>([]);

  const program = session.program;
  const analysis = useMemo(
    () => analyzeTerm(program, termOf(session.termIndex), DEFAULT_ASSUMPTIONS),
    [program, session.termIndex],
  );
  const scenario = SCENARIOS.find((s) => s.id === openScenario) ?? null;

  // Autosave every change to the session.
  useEffect(() => {
    setSaveError(writeSlot(AUTOSAVE, session, "Autosave"));
  }, [session]);

  const replaceSession = (next: TrainingSession, message: string) => {
    setSession(next);
    setOutcome(null);
    setOpenScenario(null);
    setLanded([]);
    setTab("desk");
    setNote(message);
  };

  const saveEvidence = (draft: EvidenceDraft) => setSession((s) => addEvidence(s, draft));

  const decide = (optionId: string, memo: MemoDraft | null) => {
    if (!scenario) return;
    const result = resolveScenario(session, scenario, optionId, memo);
    setSession(result.session);
    setOutcome(result.outcome);
    setOpenScenario(null);
  };

  const nextTerm = () => {
    const result = advanceTerm(session, SCENARIOS);
    setSession(result.session);
    setLanded(result.applied);
    setOutcome(null);
  };

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-row">
          <div>
            <h1>WPA Desk</h1>
            <p>
              {program.institution}
              {program.fictional && <span className="badge illustrative">fictional program</span>}
            </p>
          </div>
          <nav className="tabs" aria-label="Sections">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
                {t === "dossier" ? `Dossier (${session.dossier.length})` : TAB_LABELS[t]}
              </button>
            ))}
          </nav>
        </div>

        <dl className="status">
          <div>
            <dt>Term</dt>
            <dd>{termLabel(session.termIndex)}</dd>
          </div>
          <div>
            <dt>Admin hours left</dt>
            <dd>
              {session.adminHoursRemaining} / {session.adminHoursPerTerm}
            </dd>
          </div>
          <div>
            <dt>Political capital</dt>
            <dd>{program.politicalCapital}</dd>
          </div>
          <div>
            <dt>Instruction budget</dt>
            <dd className={analysis.budgetBalance < 0 ? "down" : ""}>
              {analysis.budgetBalance < 0
                ? `${usd(-analysis.budgetBalance)} deficit`
                : analysis.budgetBalance === 0
                  ? "Balanced"
                  : `${usd(analysis.budgetBalance)} surplus`}
            </dd>
          </div>
          {analysis.unstaffedSections > 0 && (
            <div>
              <dt>Unstaffed sections</dt>
              <dd className="down">
                {analysis.unstaffedSections} of {analysis.totalSections}
              </dd>
            </div>
          )}
        </dl>
        {note && (
          <p className="session-note small" role="status">
            {note}{" "}
            <button className="link small" onClick={() => setNote(null)}>
              Dismiss
            </button>
          </p>
        )}
        {saveError && (
          <p className="banner bad small" role="alert">
            {saveError}
          </p>
        )}
      </header>

      <main>
        {tab === "desk" &&
          (outcome ? (
            <OutcomeView outcome={outcome} program={program} onDone={() => setOutcome(null)} onDossier={() => setTab("dossier")} />
          ) : scenario ? (
            <ScenarioView
              scenario={scenario}
              session={session}
              onSaveEvidence={saveEvidence}
              onDecide={decide}
              onBack={() => setOpenScenario(null)}
            />
          ) : (
            <Desk
              session={session}
              landed={landed}
              onOpen={(id) => {
                setOpenScenario(id);
                setLanded([]);
              }}
              onNextTerm={nextTerm}
            />
          ))}
        {tab === "dossier" && <Dossier session={session} scenarios={SCENARIOS} />}
        {tab === "saves" && (
          <SavesPanel
            session={session}
            onLoad={replaceSession}
            onNewSession={() => replaceSession(startSession(MIDLAND_STATE, SCENARIOS), "Started a new session.")}
          />
        )}
        {tab === "tools" && (
          <>
            <div className="segmented tool-switch" role="group" aria-label="Tool">
              <button aria-pressed={tool === "caps"} onClick={() => setTool("caps")}>
                Class cap calculator
              </button>
              <button aria-pressed={tool === "staffing"} onClick={() => setTool("staffing")}>
                Staffing planner
              </button>
            </div>
            {tool === "caps" ? (
              <CapCalculator key={JSON.stringify(program.policies.caps)} program={program} />
            ) : (
              <StaffingPlanner key={JSON.stringify([program.instructors, program.cancellations])} program={program} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
