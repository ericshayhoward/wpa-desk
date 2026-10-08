import { ENTERED_PROGRAM_ID, MIDLAND_STATE, STAFFING_ORDER, type Course, type InstructorPool, type Program, type Rank } from "../model";

/*
 * A program as the Program data form edits it. Numbers may be NaN while a
 * field is empty, and each course carries its own cap (the program keeps caps
 * under policies, by course code, which would break while a code is being
 * typed). checkProgram(fromDraft(draft)) says what still needs fixing.
 */

export interface CourseDraft extends Course {
  cap: number;
}

export interface ProgramDraft extends Omit<Program, "courses"> {
  courses: CourseDraft[];
}

export function toDraft(program: Program): ProgramDraft {
  const p: Program = JSON.parse(JSON.stringify(program));
  return { ...p, courses: p.courses.map((c) => ({ ...c, cap: p.policies.caps[c.id] ?? NaN })) };
}

export function fromDraft(draft: ProgramDraft): Program {
  const courses = draft.courses.map(({ cap: _cap, ...c }) => ({ ...c, id: c.id.trim() }));
  const caps: Record<string, number> = {};
  draft.courses.forEach((c, i) => {
    const id = courses[i]!.id;
    if (id) caps[id] = c.cap;
  });
  const instructors = draft.instructors.map(({ overload, ...pool }) =>
    // No overloads per person is the same as no overloads.
    overload && overload.maxPerPerson !== 0 ? { ...pool, overload } : pool,
  );
  return { ...draft, courses, instructors, policies: { ...draft.policies, caps } };
}

/** The sample, to edit into your own. Game-only details (people, political capital) are left behind. */
export function copyOfSample(): ProgramDraft {
  return toDraft({
    ...MIDLAND_STATE,
    id: ENTERED_PROGRAM_ID,
    institution: `${MIDLAND_STATE.institution} (copy)`,
    fictional: false,
    stakeholders: [],
    politicalCapital: 0,
  });
}

export function blankDraft(): ProgramDraft {
  return {
    id: ENTERED_PROGRAM_ID,
    institution: "",
    description: "",
    fictional: false,
    undergraduateEnrollment: 0,
    courses: [newCourse()],
    instructors: [],
    policies: { ...MIDLAND_STATE.policies, caps: {} },
    budgetPerTerm: NaN,
    cancellations: [],
    stakeholders: [],
    politicalCapital: 0,
  };
}

export function newCourse(): CourseDraft {
  return {
    id: "",
    title: "",
    kind: "fyc1",
    credits: 3,
    seatDemand: { fall: NaN, spring: NaN },
    baselineDfw: NaN,
    baselineSectionSize: NaN,
    cap: NaN,
  };
}

export function newPool(rank: Rank): InstructorPool {
  return { rank, headcount: 0, sectionsPerTerm: 0, costPerSection: 0, paidBy: rank === "tt" ? "department" : "program", morale: 50 };
}

/** Adds a group where it falls in the staffing order, so the form lists groups in the order they're assigned sections. */
export function withPool(draft: ProgramDraft, rank: Rank): ProgramDraft {
  const order = (r: Rank) => STAFFING_ORDER.indexOf(r);
  const instructors = [...draft.instructors, newPool(rank)].sort((a, b) => order(a.rank) - order(b.rank));
  return { ...draft, instructors };
}
