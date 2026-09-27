import type { Assumptions } from "./types";

/**
 * Default assumptions for training mode.
 *
 * Every relationship the model uses lives here so it can be inspected,
 * questioned, and replaced with local data. Magnitudes marked "illustrative"
 * are placeholders chosen to be plausible, not findings.
 */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  classSizeThreshold: {
    id: "classSizeThreshold",
    label: "Recommended maximum class size",
    description:
      "Section size above which added students are assumed to reduce the " +
      "individual feedback and attention each student gets. CCCC recommends " +
      "no more than 20 students per writing course, ideally 15.",
    value: 20,
    low: 15,
    high: 20,
    unit: "students",
    confidence: "literature-informed",
    sources: ["CCCC, Principles for the Postsecondary Teaching of Writing (2015)"],
  },
  dfwPerStudentOverThreshold: {
    id: "dfwPerStudentOverThreshold",
    label: "DFW increase per student over the threshold",
    description:
      "Percentage-point rise in a course's D/F/W rate for each student per " +
      "section above the recommended maximum. Placeholder magnitude; replace " +
      "with local data where possible.",
    value: 0.6,
    low: 0.2,
    high: 1.2,
    unit: "percentage points",
    confidence: "illustrative",
    sources: [],
  },
  feedbackMinutesPerStudent: {
    id: "feedbackMinutesPerStudent",
    label: "Feedback time per student per term",
    description:
      "Instructor minutes spent responding to one student's writing over a " +
      "term (e.g., four major assignments with drafts, about 25 minutes each).",
    value: 100,
    low: 60,
    high: 160,
    unit: "minutes",
    confidence: "illustrative",
    sources: [],
  },
};
