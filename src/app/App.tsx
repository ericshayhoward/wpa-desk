import { useEffect, useMemo, useState } from "react";
import { DEFAULT_ASSUMPTIONS, MIDLAND_STATE, analyzeTerm } from "../model";
import { ARCS, CAST, SCENARIOS, STANDARD_ARC } from "../content";
import {
  abandonCommitment,
  addEvidence,
  addReflection,
  reviseMemo,
  setDraftInProgress,
  setPortfolio,
  advanceTerm,
  deliverCommitment,
  extendCommitment,
  resolveScenario,
  STAGE_LABELS,
  dissertationStatus,
  reportDue,
  resolveStaffing,
  setReportDraft,
  staffingDue,
  startSession,
  submitReport,
  termLabel,
  termOf,
  type AnnualReport,
  type DecisionOutcome,
  type EvidenceDraft,
  type MemoDraft,
  type Commitment,
  type PendingEffect,
  type TrainingSession,
} from "../training";
import { CapCalculator } from "./CapCalculator";
import { Desk } from "./Desk";
import { Dossier } from "./Dossier";
import { OutcomeView } from "./OutcomeView";
import { ScenarioView } from "./ScenarioView";
import { EndingView } from "./EndingView";
import { ReportComposer } from "./ReportComposer";
import { ReportView } from "./ReportView";
import { ReviewMode } from "./ReviewMode";
import { SavesPanel } from "./SavesPanel";
import { StaffingPlanner } from "./StaffingPlanner";
import { stakeholderName, usd } from "./format";
import { AUTOSAVE, readSlot, writeSlot } from "./storage";

type Tab = "desk" | "dossier" | "tools" | "saves";

const TAB_LABELS: Record<Tab, string> = { desk: "Desk", dossier: "Dossier", tools: "Tools", saves: "Saves" };

/** Resume from the autosave if there is a readable one; otherwise start fresh. */
function initialSession(): { session: TrainingSession; note: string | null } {
  const r = readSlot(AUTOSAVE);
  if (r.ok) return { session: r.save.session, note: `Resumed your session (${r.save.summary.term}).` };
  const fresh = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
  if ("error" in r) return { session: fresh, note: `Couldn't resume your last session (${r.error}). Started a new one.` };
  return { session: fresh, note: null };
}
type Tool = "caps" | "staffing";

/** The arc a session is playing, or undefined for free play. */
function arcOf(session: TrainingSession) {
  return ARCS.find((a) => a.id === session.arcId);
}

export function App() {
  const [initial] = useState(initialSession);
  const [session, setSession] = useState(initial.session);
  const [note, setNote] = useState<string | null>(initial.note);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("desk");
  // Instructor review is a separate mode; the game session is left untouched.
  const [reviewing, setReviewing] = useState(false);
  const [tool, setTool] = useState<Tool>("caps");
  const [openScenario, setOpenScenario] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [writingReport, setWritingReport] = useState(false);
  const [submitted, setSubmitted] = useState<AnnualReport | null>(null);
  const NOTHING_LANDED = {
    effects: [] as PendingEffect[],
    missed: [] as Commitment[],
    drift: [] as string[],
    milestones: [] as string[],
  };
  const [landed, setLanded] = useState(NOTHING_LANDED);

  const program = session.program;
  const analysis = useMemo(
    () => analyzeTerm(program, termOf(session.termIndex), DEFAULT_ASSUMPTIONS),
    [program, session.termIndex],
  );
  const scenario = SCENARIOS.find((s) => s.id === openScenario) ?? null;
  const arc = arcOf(session);
  const due = reportDue(session, arc);
  const staffing = staffingDue(session, arc, SCENARIOS);
  const dissertation = arc && dissertationStatus(session, arc);

  // Autosave every change to the session.
  useEffect(() => {
    setSaveError(writeSlot(AUTOSAVE, session, "Autosave"));
  }, [session]);

  const replaceSession = (next: TrainingSession, message: string) => {
    setSession(next);
    setOutcome(null);
    setOpenScenario(null);
    setWritingReport(false);
    setSubmitted(null);
    setLanded(NOTHING_LANDED);
    setTab("desk");
    setNote(message);
  };

  const submit = () => {
    if (!arc) return;
    const result = submitReport(session, arc, SCENARIOS, new Date());
    setSession(result.session);
    setWritingReport(false);
    // A capstone goes straight to the ending, which shows the report.
    setSubmitted(result.report.capstone ? null : result.report);
  };

  const saveEvidence = (draft: EvidenceDraft) => setSession((s) => addEvidence(s, draft));

  const decide = (optionId: string, memo: MemoDraft | null) => {
    if (!scenario) return;
    const result = resolveScenario(session, scenario, optionId, memo, CAST);
    setSession(result.session);
    setOutcome(result.outcome);
    setOpenScenario(null);
  };

  const nextTerm = () => {
    const result = advanceTerm(session, SCENARIOS, arc);
    setSession(result.session);
    setLanded({ effects: result.applied, missed: result.missed, drift: result.drift, milestones: result.milestones });
    setOutcome(null);
  };

  if (reviewing) {
    return (
      <div className="page">
        <header className="masthead no-print">
          <h1>WPA Desk</h1>
          <p className="muted">Instructor review</p>
        </header>
        <main>
          <ReviewMode onExit={() => setReviewing(false)} />
        </main>
      </div>
    );
  }

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
                {t === "dossier" ? `Dossier (${session.decisions.length})` : TAB_LABELS[t]}
              </button>
            ))}
            <button className="review-link" onClick={() => setReviewing(true)}>
              Instructor review
            </button>
          </nav>
        </div>

        <dl className="status">
          <div>
            <dt>Term</dt>
            <dd>{termLabel(session.termIndex)}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{STAGE_LABELS[session.stage]}</dd>
          </div>
          <div>
            <dt>Admin hours left</dt>
            <dd>
              {session.adminHoursRemaining} / {session.adminHoursPerTerm}
            </dd>
          </div>
          {dissertation && (
            <div title="Admin hours you leave unspent each term go to your dissertation.">
              <dt>Dissertation</dt>
              <dd>{Math.round(dissertation.progress * 100)}%</dd>
            </div>
          )}
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
          (session.ending ? (
            <EndingView
              ending={session.ending}
              report={session.reports.find((r) => r.capstone)}
              program={program}
              author={session.portfolio?.author}
              onDossier={() => setTab("dossier")}
              onNewSession={() => replaceSession(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "Started a new session.")}
            />
          ) : submitted ? (
            <div className="outcome">
              <p className="muted small">Year-end report</p>
              <h2>Report submitted</h2>
              {submitted.reply && (
                <blockquote className="reply">
                  <p>{submitted.reply.body}</p>
                  <footer>— {stakeholderName(program, submitted.reply.from)}</footer>
                </blockquote>
              )}
              <ReportView report={submitted} program={program} author={session.portfolio?.author} />
              <div className="row-end">
                <button className="primary" onClick={() => setSubmitted(null)}>
                  Back to desk
                </button>
              </div>
            </div>
          ) : writingReport && due ? (
            <ReportComposer
              session={session}
              spec={due}
              scenarios={SCENARIOS}
              onDraft={(d) => setSession((s) => setReportDraft(s, d))}
              onSubmit={submit}
              onBack={() => setWritingReport(false)}
            />
          ) : outcome ? (
            <OutcomeView
              outcome={outcome}
              program={program}
              reflection={session.decisions.find((d) => d.scenarioId === outcome.scenario.id)?.reflection}
              onReflect={(text) => setSession((s) => addReflection(s, outcome.scenario.id, text, new Date()))}
              onDone={() => setOutcome(null)}
              onDossier={() => {
                setOutcome(null);
                setTab("dossier");
              }}
            />
          ) : scenario ? (
            <ScenarioView
              scenario={scenario}
              session={session}
              onSaveEvidence={saveEvidence}
              onDecide={decide}
              onDraft={(d) => setSession((s) => setDraftInProgress(s, scenario.id, d))}
              onBack={() => setOpenScenario(null)}
            />
          ) : (
            <Desk
              session={session}
              arc={arc}
              reportDue={due}
              staffingDue={staffing}
              onStaffing={(choice) => {
                const r = resolveStaffing(session, arc, SCENARIOS, choice);
                setSession(r.session);
                setNote(r.note);
              }}
              onOpenReport={() => {
                setWritingReport(true);
                setLanded(NOTHING_LANDED);
              }}
              landed={landed}
              onOpen={(id) => {
                setOpenScenario(id);
                setLanded(NOTHING_LANDED);
              }}
              onNextTerm={nextTerm}
              onDeliver={(id) => setSession((s) => deliverCommitment(s, id))}
              onExtend={(id) => setSession((s) => extendCommitment(s, id))}
              onAbandon={(id) => setSession((s) => abandonCommitment(s, id))}
            />
          ))}
        {tab === "dossier" && (
          <Dossier
            session={session}
            scenarios={SCENARIOS}
            onReflect={(id, text) => setSession((s) => addReflection(s, id, text, new Date()))}
            onRevise={(memoId, content, note) => setSession((s) => reviseMemo(s, memoId, content, note, new Date()))}
            onPortfolio={(info) => setSession((s) => setPortfolio(s, info))}
          />
        )}
        {tab === "saves" && (
          <SavesPanel
            session={session}
            onLoad={replaceSession}
            onNewSession={() => replaceSession(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "Started a new session.")}
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
