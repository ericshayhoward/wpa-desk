/**
 * Training-mode types: scenarios, evidence, memos, and session state.
 *
 * The training layer reads the program model and proposes ProgramChanges to
 * it. The model never imports from here.
 */
import type { Program, ProgramChange, StakeholderId, Term, TermComparison } from "../model";
import type { DraftInProgress, DraftVersion, ReflectionVersion } from "./drafts";

export type CareerStage = "assistant_director" | "wpa" | "program_builder";
export type ToolId = "cap_calculator" | "staffing_planner";

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
  /** Only arrives in this kind of term. */
  term?: Term;
  /** Only arrives if the program is running an instruction deficit. */
  requiresDeficit?: boolean;
  /** Only arrives if, after its arrival changes, some sections have no instructor. */
  requiresUnstaffed?: boolean;
}

/**
 * A change a scenario can make. Most are ProgramChanges; a few are resolved
 * against the program's state at the moment of decision.
 */
export type ScenarioChange =
  | ProgramChange
  /** Cancels exactly as many sections of a course as are currently unstaffed this term. */
  | { kind: "cancelUnstaffed"; courseId: string };

/**
 * An in-character reply. `warm` and `cool` variants, if given, replace the
 * default body when the writer's trust in you is high or low.
 */
export interface Reply {
  from: StakeholderId;
  body: string;
  warm?: string;
  cool?: string;
}

/** What happens after an option is chosen: the model changes plus how it reads. */
export interface Consequence {
  narrative: string;
  changes: ScenarioChange[];
  /** Optional in-character reply from a stakeholder. */
  response?: Reply;
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
  /** A relationship this option depends on (e.g., the chair lending a colleague). */
  requires: { stakeholder: StakeholderId; minTrust: number } | null;
  /** Used when the option has no persuasion step. */
  consequence: Consequence | null;
  persuasion: Persuasion | null;
}

export interface Scenario {
  id: string;
  title: string;
  stages: CareerStage[];
  trigger: ScenarioTrigger;
  /** Changes that happen when the scenario arrives, before any decision (e.g., instructors resign). */
  arrival: ProgramChange[];
  /** Must be resolved before the term can advance. */
  urgent: boolean;
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
// Cast (authored as YAML in src/content/cast)
// ---------------------------------------------------------------------------

/**
 * A named person behind a stakeholder role. Their persuasion profile sets the
 * trust you need for a memo to land: with the evidence they want, or without it.
 */
export interface Character {
  stakeholder: StakeholderId;
  name: string;
  /** How they're addressed in the game, e.g. "Dean Alvarez". */
  shortName: string;
  title: string;
  bio: string;
  /** What moves them, shown when you write to them. */
  responds: string;
  persuasion: PersuasionProfile;
}

export interface PersuasionProfile {
  /** Trust needed to be persuaded when the memo carries the evidence they need. */
  withEvidence: number;
  /** Trust needed to take your word without it. */
  withoutEvidence: number;
}

/** For stakeholders with no named character (groups, or a program without a cast). */
export const DEFAULT_PERSUASION: PersuasionProfile = { withEvidence: 25, withoutEvidence: 80 };

/** Trust levels at which replies turn warm or cool. */
export const REPLY_TONE = { warmAt: 70, coolBelow: 40 } as const;

// ---------------------------------------------------------------------------
// Evidence and memos
// ---------------------------------------------------------------------------

export type EvidenceKind = "cap_analysis" | "staffing_plan";

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  cap_analysis: "a cost-and-impact analysis from the class cap calculator",
  staffing_plan: "a staffing plan from the staffing planner",
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
  status: "open" | "kept" | "missed";
  memoId: string;
  /** Whose trust rides on it: the memo's reader. */
  audience: StakeholderId;
  /** Admin hours it takes to deliver, spent in the term you deliver. */
  effortHours: number;
  /** One extension is allowed. */
  extended: boolean;
  resolvedTerm: number | null;
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
  commitments: { text: string; dueInTerms: number; effortHours: number }[];
  selfAssessment: Partial<Record<SelfAssessmentId, boolean>>;
  /** Drafting history up to and including the sent version. */
  history?: DraftVersion[];
  /** When the writer opened the composer. */
  startedAt?: string;
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
  /** What the situation looked like and what happened, as it was at the time. */
  snapshot?: CaseSnapshot;
  /** The player's reflection after the debrief. */
  reflection?: string;
  /** Every saved version of the reflection, oldest first. */
  reflectionHistory?: ReflectionVersion[];
}

/**
 * A record of one decision as it happened. Documents are stored with their
 * placeholders already filled, and replies with the tone chosen at the time,
 * because both depend on state that later decisions change.
 */
export interface CaseSnapshot {
  documents: ScenarioDocument[];
  narrative: string;
  reply: { from: StakeholderId; body: string } | null;
  persuasion: DecisionOutcome["persuasion"];
  missingEvidence: EvidenceKind[];
  trustChanges: DecisionOutcome["trustChanges"];
  changeDescriptions: string[];
}

/** Cover-page details for exported case files. */
export interface PortfolioInfo {
  author: string;
  course: string;
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
  portfolio?: PortfolioInfo;
  /** Unsent memos, by scenario id, so drafts survive reloads. */
  drafts?: Record<string, DraftInProgress>;
}

/** Everything the outcome screen needs to explain a decision. */
export interface DecisionOutcome {
  scenario: Scenario;
  option: ScenarioOption;
  consequence: Consequence;
  persuaded: boolean | null;
  /** Evidence kinds the option wanted but the memo did not attach. */
  missingEvidence: EvidenceKind[];
  /** How persuasion was decided: the reader's trust and what was needed. */
  persuasion: { reader: StakeholderId; trust: number; needed: number; hadEvidence: boolean } | null;
  /** The reply as it reads given the relationship (warm/cool variant already chosen). */
  reply: { from: StakeholderId; body: string } | null;
  trustChanges: { stakeholder: StakeholderId; before: number; after: number }[];
  politicalCapital: { before: number; after: number };
  /** Projected impact of this decision's program changes on the current term. */
  impact: { term: Term; comparison: TermComparison };
  /** The resolved program changes, described in plain language. */
  changeDescriptions: string[];
  queued: PendingEffect[];
  memo: Memo | null;
}
