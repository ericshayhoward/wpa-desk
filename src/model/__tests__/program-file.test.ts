import { describe, expect, it } from "vitest";
import {
  DEFAULT_ASSUMPTIONS,
  MIDLAND_STATE,
  PROGRAM_FORMAT,
  PROGRAM_VERSION,
  analyzeTerm,
  checkLocalAssumptions,
  checkProgram,
  createProgramFile,
  parseProgram,
  parseProgramFile,
  withLocalAssumptions,
  type FieldIssue,
} from "../index";

/** A small program written by hand, with only the fields the planning tools need. */
const small = () => ({
  institution: "Lakeview College",
  courses: [
    {
      id: "WRIT101",
      title: "College Writing",
      kind: "fyc1",
      credits: 3,
      seatDemand: { fall: 100, spring: 50 },
      baselineDfw: 0.15,
      baselineSectionSize: 20,
    },
  ],
  instructors: [{ rank: "adjunct", headcount: 2, sectionsPerTerm: 3, costPerSection: 4000, paidBy: "program" }],
  policies: { caps: { WRIT101: 20 } },
  budgetPerTerm: 20000,
});

const issues = (raw: unknown): FieldIssue[] => {
  const r = checkProgram(raw);
  if (r.ok) throw new Error("expected problems");
  return r.issues;
};
const only = (raw: unknown) => {
  const found = issues(raw);
  expect(found).toHaveLength(1);
  return found[0]!;
};

describe("parseProgram", () => {
  it("accepts the sample program unchanged", () => {
    expect(parseProgram(MIDLAND_STATE)).toEqual(MIDLAND_STATE);
  });

  it("accepts a small program and fills the game-only fields with defaults", () => {
    const p = parseProgram(small());
    expect(p.id).toBe("your-program");
    expect(p.fictional).toBe(false);
    expect(p.stakeholders).toEqual([]);
    expect(p.cancellations).toEqual([]);
    expect(p.instructors[0]!.morale).toBe(50);
    expect(p.policies).toMatchObject({ caps: { WRIT101: 20 }, commonSyllabus: false, portfolioAssessment: false });
    const fall = analyzeTerm(p, "fall", DEFAULT_ASSUMPTIONS);
    expect(fall.totalSections).toBe(5);
    expect(fall.unstaffedSections).toBe(0);
    expect(fall.budgetBalance).toBe(0);
  });

  it("drops fields it doesn't know", () => {
    const p = parseProgram({ ...small(), secret: "x" });
    expect("secret" in p).toBe(false);
  });

  it("names the exact field in its message, by name and by path", () => {
    const raw = small();
    raw.courses[0]!.seatDemand.fall = -5;
    expect(() => parseProgram(raw)).toThrow(
      "Course 1 (WRIT101), fall seats needed: must be a whole number, 0 or more (courses[0].seatDemand.fall).",
    );
  });

  it("says how many more problems follow the first", () => {
    expect(() => parseProgram({ ...small(), institution: "", budgetPerTerm: -1 })).toThrow(/1 more problem after this one\.$/);
  });

  it("rejects something that isn't a program", () => {
    expect(only(null)).toMatchObject({ path: "", problem: "isn't in the expected format" });
    expect(only([])).toMatchObject({ path: "" });
  });

  it.each<[string, (p: ReturnType<typeof small>) => unknown, Partial<FieldIssue>]>([
    ["a missing institution", (p) => ({ ...p, institution: undefined }), { path: "institution", problem: "needs a value" }],
    ["a blank institution", (p) => ({ ...p, institution: "  " }), { path: "institution", problem: "needs a value" }],
    ["an id that isn't text", (p) => ({ ...p, id: 7 }), { path: "id", problem: "must be text" }],
    ["a description that isn't text", (p) => ({ ...p, description: 1 }), { path: "description" }],
    ["a non-boolean sample flag", (p) => ({ ...p, fictional: "no" }), { path: "fictional", problem: "must be true or false" }],
    ["fractional enrollment", (p) => ({ ...p, undergraduateEnrollment: 1.5 }), { path: "undergraduateEnrollment" }],
    ["no course list", (p) => ({ ...p, courses: undefined, policies: { caps: {} } }), { path: "courses", problem: "are missing" }],
    ["courses that aren't a list", (p) => ({ ...p, courses: {}, policies: { caps: {} } }), { path: "courses", problem: "must be a list" }],
    ["no courses", (p) => ({ ...p, courses: [], policies: { caps: {} } }), { path: "courses", problem: "need at least one course" }],
    ["a course that isn't an object", (p) => ({ ...p, courses: [5], policies: { caps: {} } }), { path: "courses[0]", field: "Course 1" }],
    ["a blank course code", (p) => ({ ...p, courses: [{ ...p.courses[0]!, id: "" }], policies: { caps: {} } }), { path: "courses[0].id" }],
    ["a missing title", (p) => ({ ...p, courses: [{ ...p.courses[0]!, title: undefined }] }), { path: "courses[0].title", field: "Course 1 (WRIT101), title" }],
    ["an unknown kind", (p) => ({ ...p, courses: [{ ...p.courses[0]!, kind: "esl" }] }), { path: "courses[0].kind", problem: "must be one of: fyc1, fyc2, coreq, advanced" }],
    ["negative credits", (p) => ({ ...p, courses: [{ ...p.courses[0]!, credits: -1 }] }), { path: "courses[0].credits", problem: "must be a number, 0 or more" }],
    ["no seat demand", (p) => ({ ...p, courses: [{ ...p.courses[0]!, seatDemand: undefined }] }), { path: "courses[0].seatDemand", problem: "is missing" }],
    ["fractional spring seats", (p) => ({ ...p, courses: [{ ...p.courses[0]!, seatDemand: { fall: 1, spring: 2.5 } }] }), { path: "courses[0].seatDemand.spring" }],
    ["seats as text", (p) => ({ ...p, courses: [{ ...p.courses[0]!, seatDemand: { fall: "100", spring: 0 } }] }), { path: "courses[0].seatDemand.fall", problem: "must be a number" }],
    ["D/F/W as a percentage", (p) => ({ ...p, courses: [{ ...p.courses[0]!, baselineDfw: 15 }] }), { path: "courses[0].baselineDfw", problem: "must be from 0% to 100%", fileHint: "(as a fraction: 0.18 means 18%)" }],
    ["a zero observed section size", (p) => ({ ...p, courses: [{ ...p.courses[0]!, baselineSectionSize: 0 }] }), { path: "courses[0].baselineSectionSize", problem: "must be a number above 0" }],
    ["two courses with one code", (p) => ({ ...p, courses: [p.courses[0]!, { ...p.courses[0]! }] }), { path: "courses[1].id", problem: "is the same as another course's" }],
    ["no policies", (p) => ({ ...p, policies: undefined }), { path: "policies.caps", problem: "are missing" }],
    ["policies that aren't an object", (p) => ({ ...p, policies: "strict" }), { path: "policies" }],
    ["a missing cap", (p) => ({ ...p, policies: { caps: {} } }), { path: "policies.caps.WRIT101", field: "Course 1 (WRIT101), cap", problem: "needs a value" }],
    ["a zero cap", (p) => ({ ...p, policies: { caps: { WRIT101: 0 } } }), { path: "policies.caps.WRIT101", problem: "must be a whole number, 1 or more" }],
    ["a cap for no course", (p) => ({ ...p, policies: { caps: { WRIT101: 20, "WRIT 999": 20 } } }), { path: 'policies.caps["WRIT 999"]', problem: "doesn't belong to any course" }],
    ["an unknown placement", (p) => ({ ...p, policies: { ...p.policies, placement: "vibes" } }), { path: "policies.placement" }],
    ["a non-boolean policy", (p) => ({ ...p, policies: { ...p.policies, commonSyllabus: 1 } }), { path: "policies.commonSyllabus" }],
    ["instructors that aren't a list", (p) => ({ ...p, instructors: {} }), { path: "instructors", problem: "must be a list" }],
    ["an instructor group that isn't an object", (p) => ({ ...p, instructors: [null] }), { path: "instructors[0]" }],
    ["an unknown rank", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, rank: "dean" }] }), { path: "instructors[0].rank", problem: "must be one of: tt, ntt, gta, adjunct" }],
    ["a rank listed twice", (p) => ({ ...p, instructors: [p.instructors[0]!, p.instructors[0]!] }), { path: "instructors[1].rank", field: "Adjunct faculty", problem: "are listed twice" }],
    ["negative headcount", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, headcount: -1 }] }), { path: "instructors[0].headcount", field: "Adjunct faculty, people" }],
    ["fractional load", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, sectionsPerTerm: 2.5 }] }), { path: "instructors[0].sectionsPerTerm" }],
    ["missing pay", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, costPerSection: undefined }] }), { path: "instructors[0].costPerSection", problem: "needs a value" }],
    ["an unknown payer", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, paidBy: "grant" }] }), { path: "instructors[0].paidBy", problem: "must be one of: program, department" }],
    ["morale over 100", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, morale: 120 }] }), { path: "instructors[0].morale", problem: "must be a number from 0 to 100" }],
    ["overloads that aren't an object", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, overload: 1 }] }), { path: "instructors[0].overload" }],
    ["fractional overloads", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, overload: { maxPerPerson: 0.5, costPerSection: 1 } }] }), { path: "instructors[0].overload.maxPerPerson" }],
    ["negative overload pay", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, overload: { maxPerPerson: 1, costPerSection: -1 } }] }), { path: "instructors[0].overload.costPerSection" }],
    ["a note that isn't text", (p) => ({ ...p, instructors: [{ ...p.instructors[0]!, note: 3 }] }), { path: "instructors[0].note" }],
    ["a missing budget", (p) => ({ ...p, budgetPerTerm: undefined }), { path: "budgetPerTerm", field: "Budget per term", problem: "needs a value" }],
    ["a budget left blank in the editor", (p) => ({ ...p, budgetPerTerm: NaN }), { path: "budgetPerTerm", problem: "needs a value" }],
    ["an infinite budget", (p) => ({ ...p, budgetPerTerm: Infinity }), { path: "budgetPerTerm", problem: "must be a number" }],
    ["a one-term budget for summer", (p) => ({ ...p, budgetByTerm: { summer: 100 } }), { path: "budgetByTerm.summer", problem: "isn't for fall or spring" }],
    ["a one-term budget that isn't a number", (p) => ({ ...p, budgetByTerm: { fall: "lots" } }), { path: "budgetByTerm.fall" }],
    ["cancellations that aren't a list", (p) => ({ ...p, cancellations: 1 }), { path: "cancellations" }],
    ["a cancellation for no course", (p) => ({ ...p, cancellations: [{ courseId: "X", term: "fall", sections: 1 }] }), { path: "cancellations[0].courseId" }],
    ["a cancellation in summer", (p) => ({ ...p, cancellations: [{ courseId: "WRIT101", term: "summer", sections: 1 }] }), { path: "cancellations[0].term" }],
    ["stakeholders that aren't a list", (p) => ({ ...p, stakeholders: {} }), { path: "stakeholders" }],
    ["an unknown stakeholder", (p) => ({ ...p, stakeholders: [{ id: "mayor", name: "Mayor", trust: 50, priorities: [] }] }), { path: "stakeholders[0].id" }],
    ["stakeholder priorities that aren't text", (p) => ({ ...p, stakeholders: [{ id: "dean", name: "Dean", trust: 50, priorities: [1] }] }), { path: "stakeholders[0].priorities" }],
    ["political capital as text", (p) => ({ ...p, politicalCapital: "some" }), { path: "politicalCapital" }],
  ])("rejects %s", (_, change, expected) => {
    expect(only(change(small()))).toMatchObject(expected);
  });

  it("reports every problem at once, for the editor", () => {
    const raw = { ...small(), institution: "", budgetPerTerm: NaN };
    raw.courses[0]!.baselineDfw = 2;
    expect(issues(raw).map((i) => i.path)).toEqual(["institution", "courses[0].baselineDfw", "budgetPerTerm"]);
  });
});

describe("local assumptions", () => {
  const feedback = { value: 120, low: 90, high: 150, source: "Our 2025 instructor survey" };

  it("replace the defaults' numbers, marked as local data, and still give ranges", () => {
    const r = checkLocalAssumptions({ feedbackMinutesPerStudent: feedback });
    expect(r.ok).toBe(true);
    const a = withLocalAssumptions(DEFAULT_ASSUMPTIONS, r.ok ? r.value : {});
    expect(a.feedbackMinutesPerStudent).toMatchObject({ value: 120, low: 90, high: 150, confidence: "local-data", sources: ["Our 2025 instructor survey"] });
    expect(a.classSizeThreshold).toEqual(DEFAULT_ASSUMPTIONS.classSizeThreshold);
    const line = analyzeTerm(parseProgram(small()), "fall", a).staffing[0]!;
    // 3 sections × 20 students × 90–150 minutes.
    expect(line.feedbackHoursPerFullLoad).toEqual({ low: 90, mid: 120, high: 150 });
  });

  it("leave the defaults alone", () => {
    withLocalAssumptions(DEFAULT_ASSUMPTIONS, { feedbackMinutesPerStudent: feedback });
    expect(DEFAULT_ASSUMPTIONS.feedbackMinutesPerStudent.value).toBe(100);
  });

  const problem = (raw: unknown) => {
    const r = checkLocalAssumptions(raw);
    if (r.ok) throw new Error("expected problems");
    expect(r.issues).toHaveLength(1);
    return r.issues[0]!;
  };

  it.each<[string, unknown, Partial<FieldIssue>]>([
    ["something that isn't an object", [], { path: "" }],
    ["an assumption the model doesn't use", { retention: feedback }, { path: "retention", problem: "isn't one the planning tools use" }],
    ["an entry that isn't an object", { feedbackMinutesPerStudent: 5 }, { path: "feedbackMinutesPerStudent" }],
    ["a missing value", { feedbackMinutesPerStudent: { ...feedback, value: undefined } }, { path: "feedbackMinutesPerStudent.value", problem: "needs a value" }],
    ["a fractional class size", { classSizeThreshold: { value: 18.5, low: 15, high: 20 } }, { path: "classSizeThreshold.value", problem: "must be a whole number from 1 to 200" }],
    ["a negative low end", { dfwPerStudentOverThreshold: { value: 0.5, low: -1, high: 1 } }, { path: "dfwPerStudentOverThreshold.low" }],
    ["a value outside its range", { feedbackMinutesPerStudent: { ...feedback, value: 200 } }, { path: "feedbackMinutesPerStudent.value", problem: "must be between the low and high ends" }],
    ["a range of one number", { feedbackMinutesPerStudent: { value: 100, low: 100, high: 100 } }, { path: "feedbackMinutesPerStudent.high", problem: "must be above the low end, so projections show a range" }],
    ["a source that isn't text", { feedbackMinutesPerStudent: { ...feedback, source: 1 } }, { path: "feedbackMinutesPerStudent.source" }],
  ])("reject %s", (_, raw, expected) => {
    expect(problem(raw)).toMatchObject(expected);
  });
});

describe("program files", () => {
  const NOW = new Date("2026-10-08T12:00:00Z");
  const local = { feedbackMinutesPerStudent: { value: 120, low: 90, high: 150 } };
  const file = () => JSON.parse(JSON.stringify(createProgramFile(parseProgram(small()), local, NOW)));

  it("round-trip a program and its local assumptions", () => {
    const f = parseProgramFile(file());
    expect(f).toMatchObject({ format: PROGRAM_FORMAT, version: PROGRAM_VERSION, savedAt: NOW.toISOString(), assumptions: local });
    expect(f.program).toEqual(parseProgram(small()));
  });

  it("have their own format tag, so a game save isn't one", () => {
    expect(PROGRAM_FORMAT).not.toBe("wpa-desk-save");
    expect(() => parseProgramFile({ format: "wpa-desk-save", version: 8, session: {} })).toThrow("This isn't a WPA Desk program file.");
    expect(() => parseProgramFile("hello")).toThrow("This isn't a WPA Desk program file.");
    expect(() => parseProgramFile(null)).toThrow("This isn't a WPA Desk program file.");
  });

  it("need a version number", () => {
    expect(() => parseProgramFile({ ...file(), version: undefined })).toThrow("The program file has no version number.");
    expect(() => parseProgramFile({ ...file(), version: "1" })).toThrow("The program file has no version number.");
    expect(() => parseProgramFile({ ...file(), version: 1.5 })).toThrow("The program file has no version number.");
  });

  it("from a newer version ask for an update", () => {
    expect(() => parseProgramFile({ ...file(), version: PROGRAM_VERSION + 1 })).toThrow(/newer version of WPA Desk/);
  });

  it("with a version before the first are unknown", () => {
    expect(() => parseProgramFile({ ...file(), version: 0 })).toThrow("The program file has an unknown version (0).");
  });

  it("name the field inside the file when the program has a problem", () => {
    const f = file();
    f.program.instructors[0].headcount = -2;
    expect(() => parseProgramFile(f)).toThrow(
      "Adjunct faculty, people: must be a whole number, 0 or more (program.instructors[0].headcount).",
    );
    expect(() => parseProgramFile({ ...file(), program: undefined })).toThrow("The program: is missing (program).");
  });

  it("name the field inside the file when an assumption has a problem", () => {
    expect(() => parseProgramFile({ ...file(), assumptions: { feedbackMinutesPerStudent: { value: 1, low: 5, high: 9 } } })).toThrow(
      "(assumptions.feedbackMinutesPerStudent.value).",
    );
  });

  it("without assumptions use the defaults", () => {
    expect(parseProgramFile({ ...file(), assumptions: undefined }).assumptions).toEqual({});
  });

  it("without a save time still open", () => {
    expect(parseProgramFile({ ...file(), savedAt: undefined }).savedAt).toBe(new Date(0).toISOString());
  });
});
