import type { Assumptions, Program, Rank, Term } from "./types";
import { STAFFING_ORDER } from "./types";

/** A projected value with a plausible range. Projections never report a lone number. */
export interface Range {
  low: number;
  mid: number;
  high: number;
}

export interface CourseLine {
  courseId: string;
  title: string;
  seats: number;
  cap: number;
  sections: number;
  /** Seats divided by cap before rounding up to whole sections (e.g., 9.2). */
  exactSections: number;
  /** Seats spread evenly across sections. */
  avgSectionSize: number;
  /** Projected D/F/W share (0–1). */
  dfw: Range;
}

export interface StaffingLine {
  rank: Rank;
  headcount: number;
  capacity: number;
  sectionsAssigned: number;
  /** People with at least one section, assuming full loads are given first. */
  peopleTeaching: number;
  /** People in this pool with no writing sections this term. */
  peopleWithoutSections: number;
  cost: number;
  paidBy: "program" | "department";
  /** Students taught by one person carrying a full load. */
  studentsPerFullLoad: number;
  /** Feedback hours per term for one person carrying a full load. */
  feedbackHoursPerFullLoad: Range;
}

export interface TermAnalysis {
  term: Term;
  courses: CourseLine[];
  totalSeats: number;
  totalSections: number;
  staffing: StaffingLine[];
  unstaffedSections: number;
  cost: { program: number; department: number; total: number };
  /** Program budget minus program-paid cost. Negative means a deficit. */
  budgetBalance: number;
  /** Seat-weighted D/F/W share across all courses. */
  dfw: Range;
  /** Plain-language explanation of how the numbers were reached. */
  trace: string[];
}

export function analyzeTerm(program: Program, term: Term, assumptions: Assumptions): TermAnalysis {
  const trace: string[] = [];
  const threshold = assumptions.classSizeThreshold.value;
  const perStudent = assumptions.dfwPerStudentOverThreshold;
  const over = (size: number) => Math.max(0, size - threshold);

  // ---- Courses: sections needed and projected D/F/W ----
  const courses: CourseLine[] = program.courses.map((c) => {
    const cap = program.policies.caps[c.id];
    if (cap === undefined || cap < 1) {
      throw new Error(`No valid cap for course ${c.id}`);
    }
    const seats = c.seatDemand[term];
    const sections = seats > 0 ? Math.ceil(seats / cap) : 0;
    const avgSectionSize = sections > 0 ? seats / sections : 0;

    // D/F/W is calibrated to what the program observed at its baseline
    // section size; only the change in over-threshold students moves it.
    const extra = over(avgSectionSize) - over(c.baselineSectionSize);
    const shift = (pts: number) => clamp01(c.baselineDfw + (extra * pts) / 100);
    const dfw = { low: shift(perStudent.low), mid: shift(perStudent.value), high: shift(perStudent.high) };
    if (extra !== 0 && sections > 0) {
      trace.push(
        `${c.id}: average section size ${avgSectionSize.toFixed(1)} vs. baseline ` +
          `${c.baselineSectionSize} moves D/F/W from ${pct(c.baselineDfw)} to ${pct(dfw.mid)} ` +
          `(range ${pct(dfw.low)}–${pct(dfw.high)}).`,
      );
    }
    return { courseId: c.id, title: c.title, seats, cap, sections, exactSections: seats / cap, avgSectionSize, dfw };
  });

  const totalSeats = sum(courses.map((c) => c.seats));
  const totalSections = sum(courses.map((c) => c.sections));
  const avgSize = totalSections > 0 ? totalSeats / totalSections : 0;
  trace.push(`${totalSeats} seats across ${totalSections} sections (average ${avgSize.toFixed(1)} per section).`);

  // ---- Staffing: fill sections pool by pool ----
  const feedback = assumptions.feedbackMinutesPerStudent;
  let remaining = totalSections;
  const staffing: StaffingLine[] = [];
  for (const rank of STAFFING_ORDER) {
    const pool = program.instructors.find((p) => p.rank === rank);
    if (!pool) continue;
    const capacity = pool.headcount * pool.sectionsPerTerm;
    const sectionsAssigned = Math.min(remaining, capacity);
    remaining -= sectionsAssigned;
    const peopleTeaching = Math.min(pool.headcount, Math.ceil(sectionsAssigned / pool.sectionsPerTerm));
    const studentsPerFullLoad = pool.sectionsPerTerm * avgSize;
    const hours = (minutes: number) => (studentsPerFullLoad * minutes) / 60;
    staffing.push({
      rank,
      headcount: pool.headcount,
      capacity,
      sectionsAssigned,
      peopleTeaching,
      peopleWithoutSections: pool.headcount - peopleTeaching,
      cost: sectionsAssigned * pool.costPerSection,
      paidBy: pool.paidBy,
      studentsPerFullLoad,
      feedbackHoursPerFullLoad: { low: hours(feedback.low), mid: hours(feedback.value), high: hours(feedback.high) },
    });
    if (sectionsAssigned < capacity) {
      trace.push(`${rank}: ${capacity - sectionsAssigned} of ${capacity} available sections go unused.`);
    }
  }
  const unstaffedSections = remaining;
  if (unstaffedSections > 0) {
    trace.push(`${unstaffedSections} sections have no instructor; new hiring is needed.`);
  }

  // ---- Cost and budget ----
  const programCost = sum(staffing.filter((s) => s.paidBy === "program").map((s) => s.cost));
  const departmentCost = sum(staffing.filter((s) => s.paidBy === "department").map((s) => s.cost));
  const budgetBalance = program.budgetPerTerm - programCost;
  trace.push(
    `Program-paid instruction costs ${usd(programCost)} against a ${usd(program.budgetPerTerm)} budget ` +
      `(${budgetBalance >= 0 ? "surplus" : "deficit"} of ${usd(Math.abs(budgetBalance))}).`,
  );

  // ---- Seat-weighted D/F/W ----
  const weighted = (k: keyof Range) =>
    totalSeats > 0 ? sum(courses.map((c) => c.dfw[k] * c.seats)) / totalSeats : 0;
  const dfw = { low: weighted("low"), mid: weighted("mid"), high: weighted("high") };

  return {
    term,
    courses,
    totalSeats,
    totalSections,
    staffing,
    unstaffedSections,
    cost: { program: programCost, department: departmentCost, total: programCost + departmentCost },
    budgetBalance,
    dfw,
    trace,
  };
}

// ---------------------------------------------------------------------------

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function usd(x: number): string {
  return `$${Math.round(x).toLocaleString("en-US")}`;
}
