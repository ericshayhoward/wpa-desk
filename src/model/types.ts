/**
 * Program model types.
 *
 * A Program describes a writing program at a point in time. The same shape
 * holds a fictional training program or a real one, so nothing here may
 * assume training mode.
 */

export type Term = "fall" | "spring";
export const TERMS: readonly Term[] = ["fall", "spring"];

export type Rank = "tt" | "ntt" | "gta" | "adjunct";

/** Order in which instructor pools are assigned FYC sections. */
export const STAFFING_ORDER: readonly Rank[] = ["tt", "ntt", "gta", "adjunct"];

export const RANK_LABELS: Record<Rank, string> = {
  tt: "Tenure-track faculty",
  ntt: "Full-time non-tenure-track",
  gta: "Graduate teaching assistants",
  adjunct: "Adjunct faculty",
};

export type CourseKind = "fyc1" | "fyc2" | "coreq" | "advanced";

export interface Course {
  id: string;
  title: string;
  kind: CourseKind;
  credits: number;
  /** Seats needed per term. Real programs get this from their schedule. */
  seatDemand: Record<Term, number>;
  /**
   * Observed share of students earning D, F, or W, and the average section
   * size it was observed at. Projections move D/F/W relative to this point,
   * so real programs can plug in their own numbers.
   */
  baselineDfw: number;
  baselineSectionSize: number;
}

export interface InstructorPool {
  rank: Rank;
  headcount: number;
  /** Writing-program sections each person can teach per term. */
  sectionsPerTerm: number;
  /** Effective cost of one section (pay, stipend, or salary share), in dollars. */
  costPerSection: number;
  /** Whose budget pays for these sections. */
  paidBy: "program" | "department";
  /** 0–100. Not yet used by calculations; scenarios will move it. */
  morale: number;
  /**
   * Extra sections people in this pool can take beyond their regular load,
   * used only after every regular load is full. Absent means no overloads.
   */
  overload?: { maxPerPerson: number; costPerSection: number };
  /** Why the pool's limits are what they are, in plain language. */
  note?: string;
}

/** Sections deliberately not offered, leaving some students without a seat. */
export interface Cancellation {
  courseId: string;
  term: Term;
  sections: number;
}

export interface Policies {
  /** Enrollment cap per section, by course id. */
  caps: Record<string, number>;
  placement: "test_scores" | "directed_self_placement" | "multiple_measures";
  commonSyllabus: boolean;
  aiPolicy: "none" | "instructor_choice" | "program_guidance" | "detector";
  portfolioAssessment: boolean;
}

export type StakeholderId =
  | "dean"
  | "chair"
  | "fyw_director"
  | "provost_office"
  | "faculty_senate"
  | "writing_center"
  | "gta_cohort"
  | "adjunct_faculty"
  | "students"
  | "accreditor";

export const STAKEHOLDER_IDS: readonly StakeholderId[] = [
  "dean", "chair", "fyw_director", "provost_office", "faculty_senate", "writing_center",
  "gta_cohort", "adjunct_faculty", "students", "accreditor",
];

export interface Stakeholder {
  id: StakeholderId;
  name: string;
  /** 0–100. */
  trust: number;
  priorities: string[];
}

export interface Program {
  id: string;
  institution: string;
  description: string;
  /** True for invented programs; working mode will load real ones. */
  fictional: boolean;
  undergraduateEnrollment: number;
  courses: Course[];
  instructors: InstructorPool[];
  policies: Policies;
  /** Instruction budget the writing program controls, per term, in dollars. */
  budgetPerTerm: number;
  /** Additions to budgetPerTerm in one term only (e.g., a dean covering a fall gap). */
  budgetByTerm?: Partial<Record<Term, number>>;
  cancellations: Cancellation[];
  stakeholders: Stakeholder[];
  /** WPA's discretionary influence. Spent to win fights, earned by delivering. */
  politicalCapital: number;
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export type Confidence = "illustrative" | "literature-informed" | "local-data";

export interface Assumption {
  id: string;
  label: string;
  description: string;
  /** Point estimate plus a plausible range; projections report the range. */
  value: number;
  low: number;
  high: number;
  unit: string;
  confidence: Confidence;
  sources: string[];
}

export type AssumptionId =
  | "classSizeThreshold"
  | "dfwPerStudentOverThreshold"
  | "feedbackMinutesPerStudent";

export type Assumptions = Record<AssumptionId, Assumption>;
