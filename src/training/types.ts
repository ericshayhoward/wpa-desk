/**
 * Training-mode types: scenarios, evidence, memos, and session state.
 *
 * The training layer reads the program model and proposes ProgramChanges to
 * it. The model never imports from here.
 */
import type { Program, ProgramChange, StakeholderId, Term, TermComparison } from "../model";

export type CareerStage = "assistant_director" | "wpa" | "program_builder";
export type ToolId = "cap_calculator";

// ---------------------------------------------------------------------------
// Scenarios (authored as YAML in src/content/scenarios)
// ---------------------------------------------------------------------------

export interface ScenarioDocument {
  from: StakeholderId;
  genre: "memo" | "email" | "report" | "note";
  subject: string;
  body: string;
}

export interface ScenarioTrigger {
  /** Earliest term (1 = fall of year 1) the scenario can arrive. */
  minTerm?: number;
  /** Only arrives if the program is running an instruction deficit. */
  requiresDeficit?: boolean;
}

/** What happens after an option is chosen: the model changes plus how it reads. */
export interface Consequence {
  narrative: string;
  changes: ProgramChange[];
  /** Optional in-character reply from a stakeholder. */
  response?: { from: StakeholderId; body: string };
  /** Effects that land in later terms; they belong to this outcome only. */
  delayed: DelayedEffect[];
}

export interface DelayedEffect {
  inTerms: number;
  note: string;
  changes: ProgramChange[];
}

/**
 * For options that depend on persuasion: the outcome is decided mechanically
 * by whether the memo attaches the right kind of evidence, never by grading
 * the prose.
 */
export interface Persuasion {
  evidenceKinds: EvidenceKind[];
  persuaded: Consequence;
  unpersuaded: Consequence;
}

export interface ScenarioOption {
  id: string;
  label: string;
  description: string;
  cost: { adminHours: number; politicalCapital: number };
  memo: { required: boolean; audience: StakeholderId; prompt: string } | null;
  /** Used when the option has no persuasion step. */
  consequence: Consequence | null;
  persuasion: Persuasion | null;
}

export interface Scenario {
  id: string;
  title: string;
  stages: CareerStage[];
  trigger: ScenarioTrigger;
  documents: ScenarioDocument[];
  suggestedTools: ToolId[];
  options: ScenarioOption[];
  debrief: {
    weighs: string[];
    perspectives: { stakeholder: StakeholderId; view: string }[];
    readings: string[];
  };
}

// ---------------------------------------------------------------------------
// Evidence and memos
// ---------------------------------------------------------------------------

export type EvidenceKind = "cap_analysis";

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  cap_analysis: "a cost-and-impact analysis from the class cap calculator",
};

/** A snapshot of a tool result the player chose to keep. */
export interface Evidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  /** Plain-language lines suitable for pasting into a memo. */
  summary: string[];
  termIndex: number;
  data: Record<string, unknown>;
}

export interface Commitment {
  id: string;
  text: string;
  /** Term index the commitment is due. */
  dueTerm: number;
  /** Set when resolved; resolution mechanics come in a later milestone. */
  status: "open" | "kept" | "missed";
  memoId: string;
}

export const SELF_ASSESSMENT = [
  { id: "audience", label: "I wrote for this reader's priorities, not mine" },
  { id: "ask", label: "The ask or decision is clear in the first paragraph" },
  { id: "evidence", label: "Claims are backed by data or precedent" },
  { id: "tone", label: "The tone keeps the relationship workable" },
  { id: "next", label: "Next steps and who owns them are explicit" },
] as const;
export type SelfAssessmentId = (typeof SELF_ASSESSMENT)[number]["id"];

export interface MemoDraft {
  audience: StakeholderId;
  subject: string;
  ask: string;
  body: string;
  evidenceIds: string[];
  commitments: { text: string; dueInTerms: number }[];
  selfAssessment: Partial<Record<SelfAssessmentId, boolean>>;
}

export interface Memo extends Omit<MemoDraft, "commitments"> {
  id: string;
  scenarioId: string;
  optionId: string;
  termIndex: number;
  commitmentIds: string[];
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export interface PendingEffect extends DelayedEffect {
  dueTerm: number;
  scenarioId: string;
}

export interface DecisionRecord {
  scenarioId: string;
  optionId: string;
  termIndex: number;
  memoId: string | null;
  persuaded: boolean | null;
}

export interface TrainingSession {
  program: Program;
  /** 1 = fall of year 1, 2 = spring of year 1, … */
  termIndex: number;
  stage: CareerStage;
  adminHoursPerTerm: number;
  adminHoursRemaining: number;
  inbox: string[];
  decisions: DecisionRecord[];
  pending: PendingEffect[];
  evidence: Evidence[];
  dossier: Memo[];
  commitments: Commitment[];
  /** Monotonic counter for ids, so sessions stay deterministic and serializable. */
  nextId: number;
}

/** Everything the outcome screen needs to explain a decision. */
export interface DecisionOutcome {
  scenario: Scenario;
  option: ScenarioOption;
  consequence: Consequence;
  persuaded: boolean | null;
  /** Evidence kinds the option wanted but the memo did not attach. */
  missingEvidence: EvidenceKind[];
  trustChanges: { stakeholder: StakeholderId; before: number; after: number }[];
  politicalCapital: { before: number; after: number };
  /** Next term's projected impact of this decision's program changes. */
  impact: { term: Term; comparison: TermComparison };
  queued: PendingEffect[];
  memo: Memo | null;
}
