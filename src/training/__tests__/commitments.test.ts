import { describe, expect, it } from "vitest";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS as ALL_SCENARIOS, STANDARD_ARC, scenarioById } from "../../content";

/** Only the scenarios under test; others (e.g., urgent spring scenarios) would interrupt the calendar. */
const SCENARIOS = ALL_SCENARIOS.filter((s) => ["cap-memo", "late-hire"].includes(s.id));
import {
  COMMITMENT_EFFECTS,
  SAVE_VERSION,
  abandonCommitment,
  advanceTerm,
  commitmentsDue,
  createSave,
  deliverCommitment,
  extendCommitment,
  parseSave,
  resolveScenario,
  startSession,
  type TrainingSession,
} from "../index";

const dean = (s: TrainingSession) => s.program.stakeholders.find((x) => x.id === "dean")!.trust;
const lateHire = scenarioById("late-hire")!;

/** Fall Y1: compromise at 25 with a memo committing to deliver data in one term (spring). */
function committed(effortHours = 8, dueInTerms = 1): TrainingSession {
  return resolveScenario(startSession(MIDLAND_STATE, SCENARIOS), scenarioById("cap-memo")!, "compromise-25", {
    audience: "dean",
    subject: "Compromise",
    ask: "Caps of 25 for a year.",
    body: "I'll track the effects.",
    evidenceIds: [],
    commitments: [{ text: "Send the dean D/F/W data", dueInTerms, effortHours }],
    selfAssessment: {},
  }).session;
}

/** Advance, handling The Late Hire if it arrives so the term can end. */
function next(s: TrainingSession) {
  const handled = s.inbox.includes("late-hire") ? resolveScenario(s, lateHire, "add-seats", null).session : s;
  return advanceTerm(handled, SCENARIOS);
}

describe("commitments", () => {
  it("are filed with the memo's reader, effort, and due term", () => {
    const c = committed().commitments[0]!;
    expect(c).toMatchObject({ audience: "dean", effortHours: 8, dueTerm: 2, status: "open", extended: false });
  });

  it("delivering spends the effort and earns trust", () => {
    const s = next(committed()).session; // spring: due now
    expect(commitmentsDue(s)).toHaveLength(1);
    const before = dean(s);
    const after = deliverCommitment(s, s.commitments[0]!.id);
    expect(after.adminHoursRemaining).toBe(s.adminHoursRemaining - 8);
    expect(dean(after)).toBe(before + COMMITMENT_EFFECTS.keptTrust);
    expect(after.commitments[0]).toMatchObject({ status: "kept", resolvedTerm: 2 });
    expect(() => deliverCommitment(after, after.commitments[0]!.id)).toThrow(/Already resolved/);
  });

  it("can be delivered early", () => {
    const s = committed(4, 2);
    expect(commitmentsDue(s)).toHaveLength(0);
    expect(deliverCommitment(s, s.commitments[0]!.id).commitments[0]!.status).toBe("kept");
  });

  it("can't be delivered without enough admin hours", () => {
    const s = { ...next(committed(12)).session, adminHoursRemaining: 5 };
    expect(() => deliverCommitment(s, s.commitments[0]!.id)).toThrow(/Needs 12 admin hours; you have 5/);
  });

  it("one extension: due a term later, small trust cost", () => {
    const s = next(committed()).session;
    const ext = extendCommitment(s, s.commitments[0]!.id);
    expect(ext.commitments[0]).toMatchObject({ dueTerm: 3, extended: true, status: "open" });
    expect(dean(ext)).toBe(dean(s) + COMMITMENT_EFFECTS.extensionTrust);
    expect(() => extendCommitment(ext, ext.commitments[0]!.id)).toThrow(/already asked for an extension/);
  });

  it("no extensions in an arc's final term: there's no next term to push into", () => {
    const spring = next(committed()).session;
    const endsNow = { ...STANDARD_ARC, terms: spring.termIndex };
    expect(() => extendCommitment(spring, spring.commitments[0]!.id, endsNow)).toThrow(/No extensions in your last term/);
    // Earlier in the same arc, the extension is still there.
    expect(extendCommitment(spring, spring.commitments[0]!.id, STANDARD_ARC).commitments[0]!.extended).toBe(true);
  });

  it("extensions are only for commitments that are due", () => {
    const s = committed(4, 2);
    expect(() => extendCommitment(s, s.commitments[0]!.id)).toThrow(/isn't due yet/);
  });

  it("letting it go costs the same as missing it", () => {
    const s = next(committed()).session;
    const gone = abandonCommitment(s, s.commitments[0]!.id);
    expect(gone.commitments[0]!.status).toBe("missed");
    expect(dean(gone)).toBe(dean(s) + COMMITMENT_EFFECTS.missedTrust);
  });

  it("anything still open when the term ends is missed, and reported", () => {
    const spring = next(committed()).session;
    const before = dean(spring);
    const { session, missed } = next(spring);
    expect(missed.map((c) => c.text)).toEqual(["Send the dean D/F/W data"]);
    expect(session.commitments[0]).toMatchObject({ status: "missed", resolvedTerm: 2 });
    // The dean also reacts to the late-hire choice made along the way, so compare only the commitment's share.
    expect(dean(session)).toBeLessThanOrEqual(before + COMMITMENT_EFFECTS.missedTrust);
  });

  it("an extended commitment isn't missed until its new due term", () => {
    const spring = next(committed()).session;
    const extended = extendCommitment(spring, spring.commitments[0]!.id);
    const fall2 = next(extended);
    expect(fall2.missed).toHaveLength(0);
    expect(commitmentsDue(fall2.session)).toHaveLength(1);
  });
});

describe("save migration v1 → v2", () => {
  it("upgrades old commitments with the memo's audience and a default effort", () => {
    const s = committed();
    const v1 = JSON.parse(JSON.stringify(createSave(s, "Old", new Date())));
    v1.version = 1;
    for (const c of v1.session.commitments) {
      delete c.audience;
      delete c.effortHours;
      delete c.extended;
      delete c.resolvedTerm;
    }
    const loaded = parseSave(v1, SCENARIOS);
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.session.commitments[0]).toMatchObject({ audience: "dean", effortHours: 4, extended: false, resolvedTerm: null });
  });
});
