import { useMemo, useState } from "react";
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
} from "../training";
import { CapCalculator } from "./CapCalculator";
import { Desk } from "./Desk";
import { Dossier } from "./Dossier";
import { OutcomeView } from "./OutcomeView";
import { ScenarioView } from "./ScenarioView";
import { usd } from "./format";

type Tab = "desk" | "dossier" | "tools";

export function App() {
  const [session, setSession] = useState(() => startSession(MIDLAND_STATE, SCENARIOS));
  const [tab, setTab] = useState<Tab>("desk");
  const [openScenario, setOpenScenario] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [landed, setLanded] = useState<PendingEffect[]>([]);

  const program = session.program;
  const analysis = useMemo(
    () => analyzeTerm(program, termOf(session.termIndex), DEFAULT_ASSUMPTIONS),
    [program, session.termIndex],
  );
  const scenario = SCENARIOS.find((s) => s.id === openScenario) ?? null;

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
            {(["desk", "dossier", "tools"] as Tab[]).map((t) => (
              <button key={t} aria-current={tab === t ? "page" : undefined} onClick={() => setTab(t)}>
                {t === "desk" ? "Desk" : t === "dossier" ? `Dossier (${session.dossier.length})` : "Tools"}
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
        </dl>
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
        {tab === "tools" && <CapCalculator key={JSON.stringify(program.policies.caps)} program={program} />}
      </main>
    </div>
  );
}
