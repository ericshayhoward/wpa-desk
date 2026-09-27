import type { Assumptions, Program, Rank, Term } from "./types";
import { STAFFING_ORDER } from "./types";

/** A projected value with a plausible range. Projections never report a lone number. */
export interface Range {
  low: number;
  mid: number;
  high: number;
}

/**
 * A range as text: "18.3%–21.1%", or one value when both ends print the same
 * (as D/F/W does at a course's baseline section size, where nothing moves it).
 */
export function rangeLabel(r: { low: number; high: number }, fmt: (n: number) => string): string {
  const low = fmt(r.low);
  const high = fmt(r.high);
  return low === high ? low : `${low}–${high}`;
}

export interface CourseLine {
  courseId: string;
  title: string;
  /** Seats students need (demand). */
  seats: number;
  cap: number;
  /** Sections actually offered (needed minus cancelled). These get staffed. */
  sections: number;
  /** Sections needed to seat every student at this cap. */
  sectionsNeeded: number;
  sectionsCancelled: number;
  /** Seats divided by cap before rounding up to whole sections (e.g., 9.2). */
  exactSections: number;
  /** Students who get a seat, and those left without one because of cancellations. */
  seatsServed: number;
  seatsUnserved: number;
  /** Seated students spread evenly across offered sections. */
  avgSectionSize: number;
  /** Projected D/F/W share (0–1). */
  dfw: Range;
}

export interface StaffingLine {
  rank: Rank;
  headcount: number;
  /** Regular-load capacity (headcount × sections per person). */
  capacity: number;
  /** All sections this pool teaches, including overloads. */
  sectionsAssigned: number;
  overloadCapacity: number;
  overloadSections: number;
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
  totalSeatsServed: number;
  totalSeatsUnserved: number;
  totalSections: number;
  totalSectionsCancelled: number;
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

  // ---- Courses: sections needed, cancellations, and projected D/F/W ----
  const courses: CourseLine[] = program.courses.map((c) => {
    const cap = program.policies.caps[c.id];
    if (cap === undefined || cap < 1) {
      throw new Error(`No valid cap for course ${c.id}`);
    }
    const seats = c.seatDemand[term];
    const sectionsNeeded = seats > 0 ? Math.ceil(seats / cap) : 0;
    const requested = sum(
      (program.cancellations ?? []).filter((x) => x.courseId === c.id && x.term === term).map((x) => x.sections),
    );
    const sectionsCancelled = Math.min(sectionsNeeded, Math.max(0, requested));
    const sections = sectionsNeeded - sectionsCancelled;
    const seatsServed = Math.min(seats, sections * cap);
    const seatsUnserved = seats - seatsServed;
    const avgSectionSize = sections > 0 ? seatsServed / sections : 0;
    if (sectionsCancelled > 0) {
      trace.push(
        `${c.id}: cancelling ${sectionsCancelled} of ${sectionsNeeded} sections leaves ` +
          `${seatsUnserved} students without a seat.`,
      );
    }

    // D/F/W is calibrated to what the program observed at its baseline
    // section size; only the change in over-threshold students moves it.
    const extra = over(avgSectionSize) - over(c.baselineSectionSize);
    const shift = (pts: number) => clamp01(c.baselineDfw + (extra * pts) / 100);
    const dfw = { low: shift(perStudent.low), mid: shift(perStudent.value), high: shift(perStudent.high) };
    if (extra !== 0 && sections > 0) {
      trace.push(
        `${c.id}: average section size ${avgSectionSize.toFixed(1)} vs. baseline ` +
          `${c.baselineSectionSize} moves D/F/W from ${pct(c.baselineDfw)} to ${pct(dfw.mid)} ` +
          `(range ${rangeLabel(dfw, pct)}).`,
      );
    }
    return {
      courseId: c.id,
      title: c.title,
      seats,
      cap,
      sections,
      sectionsNeeded,
      sectionsCancelled,
      exactSections: seats / cap,
      seatsServed,
      seatsUnserved,
      avgSectionSize,
      dfw,
    };
  });

  const totalSeats = sum(courses.map((c) => c.seats));
  const totalSeatsServed = sum(courses.map((c) => c.seatsServed));
  const totalSeatsUnserved = totalSeats - totalSeatsServed;
  const totalSections = sum(courses.map((c) => c.sections));
  const totalSectionsCancelled = sum(courses.map((c) => c.sectionsCancelled));
  const avgSize = totalSections > 0 ? totalSeatsServed / totalSections : 0;
  trace.push(`${totalSeatsServed} seats across ${totalSections} sections (average ${avgSize.toFixed(1)} per section).`);

  // ---- Staffing: fill regular loads pool by pool, then overloads ----
  const feedback = assumptions.feedbackMinutesPerStudent;
  let remaining = totalSections;
  const pools = STAFFING_ORDER.map((rank) => program.instructors.find((p) => p.rank === rank)).filter(
    (p): p is NonNullable<typeof p> => p !== undefined,
  );

  const regular = new Map<Rank, number>();
  for (const pool of pools) {
    const assigned = Math.min(remaining, pool.headcount * pool.sectionsPerTerm);
    regular.set(pool.rank, assigned);
    remaining -= assigned;
  }
  const overloads = new Map<Rank, number>();
  for (const pool of pools) {
    const assigned = Math.min(remaining, pool.headcount * (pool.overload?.maxPerPerson ?? 0));
    overloads.set(pool.rank, assigned);
    remaining -= assigned;
    if (assigned > 0) {
      trace.push(
        `${pool.rank}: ${assigned} overload section${assigned === 1 ? "" : "s"} ` +
          `at ${usd(pool.overload!.costPerSection)} each, after every regular load is full.`,
      );
    }
  }

  const staffing: StaffingLine[] = pools.map((pool) => {
    const capacity = pool.headcount * pool.sectionsPerTerm;
    const regularSections = regular.get(pool.rank) ?? 0;
    const overloadSections = overloads.get(pool.rank) ?? 0;
    const peopleTeaching =
      pool.sectionsPerTerm > 0 ? Math.min(pool.headcount, Math.ceil(regularSections / pool.sectionsPerTerm)) : 0;
    const studentsPerFullLoad = pool.sectionsPerTerm * avgSize;
    const hours = (minutes: number) => (studentsPerFullLoad * minutes) / 60;
    if (regularSections < capacity) {
      trace.push(`${pool.rank}: ${capacity - regularSections} of ${capacity} available sections go unused.`);
    }
    return {
      rank: pool.rank,
      headcount: pool.headcount,
      capacity,
      sectionsAssigned: regularSections + overloadSections,
      overloadCapacity: pool.headcount * (pool.overload?.maxPerPerson ?? 0),
      overloadSections,
      peopleTeaching,
      peopleWithoutSections: pool.headcount - peopleTeaching,
      cost: regularSections * pool.costPerSection + overloadSections * (pool.overload?.costPerSection ?? 0),
      paidBy: pool.paidBy,
      studentsPerFullLoad,
      feedbackHoursPerFullLoad: { low: hours(feedback.low), mid: hours(feedback.value), high: hours(feedback.high) },
    };
  });

  const unstaffedSections = remaining;
  if (unstaffedSections > 0) {
    trace.push(
      `${unstaffedSections} section${unstaffedSections === 1 ? " has" : "s have"} no instructor. ` +
        `Closing the gap means hiring, assigning overloads, or cancelling sections.`,
    );
  }

  // ---- Cost and budget ----
  const programCost = sum(staffing.filter((s) => s.paidBy === "program").map((s) => s.cost));
  const departmentCost = sum(staffing.filter((s) => s.paidBy === "department").map((s) => s.cost));
  const budgetBalance = program.budgetPerTerm - programCost;
  trace.push(
    `Program-paid instruction costs ${usd(programCost)} against a ${usd(program.budgetPerTerm)} budget ` +
      `(${budgetBalance >= 0 ? "surplus" : "deficit"} of ${usd(Math.abs(budgetBalance))}).`,
  );

  // ---- D/F/W weighted by seated students ----
  const weighted = (k: keyof Range) =>
    totalSeatsServed > 0 ? sum(courses.map((c) => c.dfw[k] * c.seatsServed)) / totalSeatsServed : 0;
  const dfw = { low: weighted("low"), mid: weighted("mid"), high: weighted("high") };

  return {
    term,
    courses,
    totalSeats,
    totalSeatsServed,
    totalSeatsUnserved,
    totalSections,
    totalSectionsCancelled,
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
