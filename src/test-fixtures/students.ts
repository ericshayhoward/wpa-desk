/** Two plausible student sessions for review tests. */
import { DEFAULT_ASSUMPTIONS as A, MIDLAND_STATE, analyzeTerm, applyChanges } from "../model";
import { CAST, SCENARIOS, scenarioById } from "../content";
import {
  addEvidence,
  addReflection,
  advanceTerm,
  capAnalysisEvidence,
  resolveScenario,
  setPortfolio,
  snapshot,
  startSession,
  type TrainingSession,
} from "../training";

const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 10, min));

/** Countered with evidence after two drafts, reflected, kept going to spring. */
export function avery(): TrainingSession {
  let s = setPortfolio(startSession(MIDLAND_STATE, SCENARIOS), { author: "Avery Chen", course: "ENGL 790" });
  const proposed = applyChanges(s.program, [{ kind: "setCap", courseId: "ENGL101", cap: 27 }]);
  s = addEvidence(s, capAnalysisEvidence(s.program, { ...s.program.policies.caps, ENGL101: 27 }, analyzeTerm(s.program, "fall", A), analyzeTerm(proposed, "fall", A)));
  let h = snapshot([], { subject: "Caps", ask: "Hold caps.", body: "Caps matter for feedback." }, "draft", at(0), "First pass");
  h = snapshot(h, { subject: "Caps", ask: "Hold caps at 24.", body: "Caps matter for feedback and retention." }, "sent", at(12));
  s = resolveScenario(
    s,
    scenarioById("cap-memo")!,
    "counter-with-data",
    {
      audience: "dean", subject: "Caps", ask: "Hold caps at 24.", body: "Caps matter for feedback and retention.",
      evidenceIds: [s.evidence[0]!.id], commitments: [{ text: "Share D/F/W data", dueInTerms: 1, effortHours: 4 }],
      selfAssessment: {}, history: h, startedAt: at(0).toISOString(),
    },
    CAST,
  ).session;
  s = addReflection(s, "cap-memo", "Numbers carried the argument.", at(20));
  return advanceTerm(s, SCENARIOS).session;
}

/** Accepted the increase without a memo; no reflection. */
export function blake(): TrainingSession {
  const s = setPortfolio(startSession(MIDLAND_STATE, SCENARIOS), { author: "Blake Ortiz", course: "ENGL 790" });
  return resolveScenario(s, scenarioById("cap-memo")!, "accept", null, CAST).session;
}
