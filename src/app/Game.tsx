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
import { Campus } from "./Campus";
import { CapCalculator } from "./CapCalculator";
import { Desk } from "./Desk";
import { Dossier } from "./Dossier";
import { OutcomeView } from "./OutcomeView";
import { ScenarioView } from "./ScenarioView";
import { EndingView } from "./EndingView";
import { ReportComposer } from "./ReportComposer";
import { ReportView } from "./ReportView";
import { SavesPanel } from "./SavesPanel";
import { StaffingPlanner } from "./StaffingPlanner";
import { stakeholderName, usd } from "./format";
import {
  AUTOSAVE,
  backupMark,
  clearBrowserSaves,
  downloadSession,
  needsBackup,
  readBackup,
  readCampusOpen,
  requestPersistence,
  writeBackup,
  writeCampusOpen,
  writeSlot,
  type BackupMark,
} from "./storage";
import { Brand, Colophon, HomeButton, ThemeToggle } from "./Frame";
import { Bar, Icon, TermTrack, type IconName } from "./ui";

type Tab = "desk" | "dossier" | "tools" | "saves";

const TAB_LABELS: Record<Tab, string> = { desk: "Desk", dossier: "Dossier", tools: "Tools", saves: "Saves" };
const TAB_ICONS: Record<Tab, IconName> = { desk: "desk", dossier: "folder", tools: "sliders", saves: "save" };

type Tool = "caps" | "staffing";

/** The arc a session is playing, or undefined for free play. */
function arcOf(session: TrainingSession) {
  return ARCS.find((a) => a.id === session.arcId);
}

interface Props {
  /** The session to play: resumed, new, or opened from a file. */
  initial: TrainingSession;
  initialNote?: string | null;
  onHome: () => void;
}

/** The game: desk, dossier, tools, saves, and the campus map, for one training session. */
export function Game({ initial, initialNote = null, onHome }: Props) {
  const [session, setSession] = useState(initial);
  const [note, setNote] = useState<string | null>(initialNote);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The last copy kept outside this browser, for the export reminder.
  const [backup, setBackup] = useState(readBackup);
  const [tab, setTab] = useState<Tab>("desk");
  const [tool, setTool] = useState<Tool>("caps");
  const [campusOpen, setCampusOpen] = useState(readCampusOpen);
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
  // The term just advanced into, for the brief term-change card.
  const [arrived, setArrived] = useState<number | null>(null);

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

  const keepBackup = (mark: BackupMark | null) => {
    writeBackup(mark);
    setBackup(mark);
  };

  const exportCopy = () => {
    const name = downloadSession(session, "Exported session");
    keepBackup(backupMark(session, new Date()));
    return name;
  };

  /** A session from a file already has a copy outside the browser; one from a slot or a fresh start doesn't. */
  const replaceSession = (next: TrainingSession, message: string, fromFile = false) => {
    keepBackup(fromFile ? backupMark(next, new Date()) : null);
    setSession(next);
    setOutcome(null);
    setOpenScenario(null);
    setWritingReport(false);
    setSubmitted(null);
    setLanded(NOTHING_LANDED);
    setArrived(null);
    setTab("desk");
    setNote(message);
  };

  const submit = () => {
    if (!arc) return;
    let result: ReturnType<typeof submitReport>;
    try {
      result = submitReport(session, arc, SCENARIOS, new Date());
    } catch (err) {
      // The desk guards these cases; if one slips through, say why instead of doing nothing.
      setNote((err as Error).message);
      setWritingReport(false);
      return;
    }
    setSession(result.session);
    setWritingReport(false);
    // A capstone goes straight to the ending, which shows the report.
    setSubmitted(result.report.capstone ? null : result.report);
  };

  const saveEvidence = (draft: EvidenceDraft) => setSession((s) => addEvidence(s, draft));

  const decide = (optionId: string, memo: MemoDraft | null) => {
    if (!scenario) return;
    const result = resolveScenario(session, scenario, optionId, memo, CAST);
    requestPersistence();
    setSession(result.session);
    setOutcome(result.outcome);
    setOpenScenario(null);
  };

  const nextTerm = () => {
    const result = advanceTerm(session, SCENARIOS, arc);
    setSession(result.session);
    setLanded({ effects: result.applied, missed: result.missed, drift: result.drift, milestones: result.milestones });
    setOutcome(null);
    setArrived(result.session.termIndex);
  };

  /** From the campus map: leave whatever's open (drafts are already saved) and go to the desk. */
  const toDesk = (scenarioId: string | null) => {
    setTab("desk");
    setOutcome(null);
    setWritingReport(false);
    setSubmitted(null);
    setLanded(NOTHING_LANDED);
    setOpenScenario(scenarioId);
  };

  const hoursLeft = session.adminHoursRemaining / Math.max(1, session.adminHoursPerTerm);
  const view = session.ending
    ? "ending"
    : submitted
      ? "submitted"
      : writingReport
        ? "report"
        : outcome
          ? `outcome-${outcome.scenario.id}`
          : scenario
            ? `scenario-${scenario.id}`
            : "desk";

  // Announced changes that just took effect, for the term-change card.
  const landedScheduled = landed.effects.filter((p) => p.announced);

  // Each new view starts at the top, not wherever the last one was scrolled to.
  const viewKey = tab === "desk" ? view : tab;
  useEffect(() => {
    document.scrollingElement?.scrollTo?.({ top: 0 });
  }, [viewKey]);

  return (
    <div className={`app${campusOpen ? " with-campus" : ""}`}>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="masthead-row">
            <Brand
              sub={
                <>
                  {program.institution}
                  {program.fictional && <span className="badge illustrative">fictional program</span>}
                </>
              }
            />
            <div className="masthead-actions">
              <nav className="tabs" aria-label="Sections">
                {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                  <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
                    <Icon name={TAB_ICONS[t]} size={16} />
                    {t === "dossier" ? `Dossier (${session.decisions.length})` : TAB_LABELS[t]}
                  </button>
                ))}
              </nav>
              <HomeButton onHome={onHome} />
              <ThemeToggle />
            </div>
          </div>

          <dl className="status">
            <div className="stat stat-term">
              <dt>
                <Icon name="calendar" size={14} /> Term
              </dt>
              <dd>{termLabel(session.termIndex)}</dd>
              {arc && <TermTrack terms={arc.terms} current={session.termIndex} />}
            </div>
            <div className="stat">
              <dt>
                <Icon name="user" size={14} /> Role
              </dt>
              <dd>{STAGE_LABELS[session.stage]}</dd>
            </div>
            <div className="stat">
              <dt>
                <Icon name="clock" size={14} /> Admin hours left
              </dt>
              <dd>
                {session.adminHoursRemaining} / {session.adminHoursPerTerm}
              </dd>
              <Bar value={hoursLeft} tone={hoursLeft < 0.25 ? "warn" : "accent"} />
            </div>
            {dissertation && (
              <div className="stat" title="Admin hours you leave unspent each term go to your dissertation.">
                <dt>
                  <Icon name="book" size={14} /> Dissertation
                </dt>
                <dd>{Math.round(dissertation.progress * 100)}%</dd>
                <Bar value={dissertation.progress} tone="good" />
              </div>
            )}
            <div className="stat">
              <dt>
                <Icon name="capital" size={14} /> Political capital
              </dt>
              <dd>{program.politicalCapital}</dd>
            </div>
            <div className="stat">
              <dt>
                <Icon name="wallet" size={14} /> Instruction budget
              </dt>
              <dd className={analysis.budgetBalance < 0 ? "down" : analysis.budgetBalance > 0 ? "up" : ""}>
                {analysis.budgetBalance < 0
                  ? `${usd(-analysis.budgetBalance)} deficit`
                  : analysis.budgetBalance === 0
                    ? "Balanced"
                    : `${usd(analysis.budgetBalance)} surplus`}
              </dd>
            </div>
            {analysis.unstaffedSections > 0 && (
              <div className="stat stat-alert">
                <dt>
                  <Icon name="alert" size={14} /> Unstaffed sections
                </dt>
                <dd className="down">
                  {analysis.unstaffedSections} of {analysis.totalSections}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {arrived !== null && (
        <div key={arrived} className="term-flip" aria-hidden="true">
          <div>
            <span data-text="A new term begins" />
            {/* Drawn from attributes so the labels aren't duplicated in the DOM's text. */}
            <strong data-text={termLabel(arrived)} />
            <em data-text={STAGE_LABELS[session.stage]} />
            {landedScheduled.length > 0 && (
              <small
                data-text={
                  landedScheduled.length === 1 ? landedScheduled[0]!.note : `${landedScheduled.length} scheduled changes take effect`
                }
              />
            )}
          </div>
        </div>
      )}

      <div className="page">
        {note && (
          <p className="session-note toast" role="status">
            <Icon name="sparkle" size={16} />
            <span>{note}</span>{" "}
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
        {tab === "desk" && !outcome && !scenario && !writingReport && !submitted && session.decisions.length === 0 && (
          <p className="storage-note no-print">
            <Icon name="save" size={16} />
            <span>
              Your progress saves in this browser only; nothing is sent anywhere. On a shared computer, export your work and
              clear it from the Saves tab when you're done.
            </span>
          </p>
        )}
        {tab === "desk" && !outcome && !scenario && !writingReport && !submitted && needsBackup(session, backup, new Date()) && (
          <aside className="banner note no-print" aria-label="Keep a copy">
            <Icon name="save" size={18} />
            <div>
              <p>
                <strong>Keep a copy of your progress.</strong> Your session is saved in this browser, but browsers can clear
                saved data (Safari does after about a week away). Export a file to keep it safe.
              </p>
              <div className="banner-actions">
                <button
                  className="secondary"
                  onClick={() => {
                    const name = exportCopy();
                    setNote(`Exported ${name}.`);
                  }}
                >
                  Export a copy
                </button>
                <button className="link small" onClick={() => keepBackup(backupMark(session, new Date(), true))}>
                  Not now
                </button>
              </div>
            </div>
          </aside>
        )}

        <main key={viewKey} className="view">
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
                onExtend={(id) => setSession((s) => extendCommitment(s, id, arc))}
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
              onExport={exportCopy}
              onClearAll={() => {
                clearBrowserSaves();
                replaceSession(
                  startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC),
                  "Cleared this browser's saves and started a new session.",
                );
              }}
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
      <Campus
        session={session}
        analysis={analysis}
        reportDue={due}
        staffingDue={staffing}
        dissertation={dissertation}
        open={campusOpen}
        onToggle={(open) => {
          writeCampusOpen(open);
          setCampusOpen(open);
        }}
        onOpenScenario={toDesk}
        onGoToDesk={() => toDesk(null)}
      />
      <Colophon />
    </div>
  );
}
