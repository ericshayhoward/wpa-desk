import type { Program } from "../types";

/**
 * Midland State University — the fictional starter program for training mode.
 *
 * A regional public university with a heavily contingent FYC staff, a small
 * standing budget deficit, and no recent assessment. All figures are invented
 * but chosen to be plausible for this kind of institution.
 *
 * Per term: 60 FYC sections. Staffing ≈ 15% full-time, 25% GTA, 60% adjunct.
 */
export const MIDLAND_STATE: Program = {
  id: "midland-state",
  institution: "Midland State University",
  description:
    "Regional public university, about 9,000 undergraduates. Two-course " +
    "first-year sequence with a co-requisite studio option. Placement by " +
    "standardized test scores. No program-wide assessment in three years.",
  fictional: true,
  undergraduateEnrollment: 9000,
  courses: [
    {
      id: "ENGL101",
      title: "Composition I",
      kind: "fyc1",
      credits: 3,
      seatDemand: { fall: 1152, spring: 240 },
      baselineDfw: 0.18,
      baselineSectionSize: 24,
    },
    {
      id: "ENGL101S",
      title: "Composition I with Studio",
      kind: "coreq",
      credits: 4,
      seatDemand: { fall: 180, spring: 36 },
      baselineDfw: 0.22,
      baselineSectionSize: 18,
    },
    {
      id: "ENGL102",
      title: "Composition II",
      kind: "fyc2",
      credits: 3,
      seatDemand: { fall: 48, spring: 1152 },
      baselineDfw: 0.12,
      baselineSectionSize: 24,
    },
  ],
  instructors: [
    { rank: "tt", headcount: 3, sectionsPerTerm: 1, costPerSection: 19500, paidBy: "department", morale: 65 },
    { rank: "ntt", headcount: 2, sectionsPerTerm: 3, costPerSection: 6500, paidBy: "program", morale: 60 },
    { rank: "gta", headcount: 15, sectionsPerTerm: 1, costPerSection: 9000, paidBy: "program", morale: 55 },
    { rank: "adjunct", headcount: 14, sectionsPerTerm: 3, costPerSection: 3600, paidBy: "program", morale: 45 },
  ],
  policies: {
    caps: { ENGL101: 24, ENGL101S: 18, ENGL102: 24 },
    placement: "test_scores",
    commonSyllabus: true,
    aiPolicy: "instructor_choice",
    portfolioAssessment: false,
  },
  budgetPerTerm: 295000,
  stakeholders: [
    { id: "dean", name: "Dean of Arts & Sciences", trust: 55, priorities: ["balanced budget", "enrollment growth", "accreditation readiness"] },
    { id: "chair", name: "English Department Chair", trust: 60, priorities: ["TT research time", "graduate program health"] },
    { id: "provost_office", name: "Provost's Office", trust: 50, priorities: ["retention", "academic integrity", "efficiency"] },
    { id: "faculty_senate", name: "Faculty Senate", trust: 50, priorities: ["shared governance", "academic freedom"] },
    { id: "writing_center", name: "Writing Center Director", trust: 65, priorities: ["tutor funding", "partnership with FYC"] },
    { id: "gta_cohort", name: "Graduate Teaching Assistants", trust: 50, priorities: ["stipends", "teaching preparation", "time to degree"] },
    { id: "adjunct_faculty", name: "Adjunct Faculty", trust: 40, priorities: ["pay per section", "course security", "professional development"] },
    { id: "students", name: "Students", trust: 55, priorities: ["small classes", "fair grading", "clear expectations"] },
    { id: "accreditor", name: "Regional Accreditor", trust: 50, priorities: ["documented learning outcomes", "assessment evidence"] },
  ],
  politicalCapital: 20,
};
