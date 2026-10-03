// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { MIDLAND_STATE } from "../../model";
import { CAST, SCENARIOS, STANDARD_ARC } from "../../content";
import { createSave, resolveScenario, startSession, type TrainingSession } from "../../training";
import { backupMark, needsBackup } from "../storage";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const NOW = new Date("2026-10-03T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const fresh = startSession(MIDLAND_STATE, SCENARIOS);
/** A session with `n` decisions; the reminder only counts them. */
const withDecisions = (s: TrainingSession, n: number): TrainingSession => ({
  ...s,
  decisions: Array.from({ length: n }, () => ({}) as TrainingSession["decisions"][number]),
});

describe("needsBackup", () => {
  it("waits for a first decision", () => {
    expect(needsBackup(fresh, null, NOW)).toBe(false);
    expect(needsBackup(withDecisions(fresh, 1), null, NOW)).toBe(true);
  });

  it("stays quiet with no progress since the last copy, however long ago", () => {
    const s = withDecisions(fresh, 2);
    const mark = backupMark(s, new Date(NOW.getTime() - 30 * DAY_MS));
    expect(needsBackup(s, mark, NOW)).toBe(false);
  });

  it("comes back after a new term, or after a week with new decisions", () => {
    const s = withDecisions(fresh, 2);
    const mark = backupMark(s, NOW);
    const later = withDecisions(s, 3);
    expect(needsBackup(later, mark, new Date(NOW.getTime() + DAY_MS))).toBe(false);
    expect(needsBackup(later, mark, new Date(NOW.getTime() + 7 * DAY_MS))).toBe(true);
    expect(needsBackup({ ...s, termIndex: 2 }, mark, new Date(NOW.getTime() + DAY_MS))).toBe(true);
  });

  it('after "Not now", waits for the next term rather than a week', () => {
    const s = withDecisions(fresh, 2);
    const snoozed = backupMark(s, NOW, true);
    expect(needsBackup(withDecisions(s, 5), snoozed, new Date(NOW.getTime() + 30 * DAY_MS))).toBe(false);
    expect(needsBackup({ ...s, termIndex: 2 }, snoozed, NOW)).toBe(true);
  });
});

describe("the export reminder", () => {
  const reminder = () => screen.queryByRole("complementary", { name: "Keep a copy" });

  const decideSyllabusHoldout = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /Alan Pruitt and the common syllabus/ }));
    await user.click(screen.getByRole("button", { name: /Meet with Alan about outcomes, not the syllabus/ }));
    await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
    await user.click(screen.getByRole("button", { name: "Back to desk" }));
  };

  it("appears after the first decision, exports a copy, and goes away", async () => {
    const createObjectURL = vi.fn(() => "blob:save");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<App />);
    expect(reminder()).toBeNull();

    await decideSyllabusHoldout(user);
    expect(reminder()).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Export a copy" }));
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByText(/Exported wpa-desk-fall-year-1-\d{4}-\d{2}-\d{2}\.json\./)).toBeTruthy();
    expect(reminder()).toBeNull();
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('"Not now" hides it until the next term, across reloads', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await decideSyllabusHoldout(user);
    await user.click(screen.getByRole("button", { name: "Not now" }));
    expect(reminder()).toBeNull();
    first.unmount();

    render(<App />);
    expect(reminder()).toBeNull();
    await user.click(screen.getByRole("button", { name: /advance/i }));
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
    expect(reminder()).toBeTruthy();
  });

  it("doesn't appear for a session just imported from a file", async () => {
    const start = startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC);
    const holdout = SCENARIOS.find((s) => s.id === "syllabus-holdout")!;
    const decided = resolveScenario(start, holdout, "outcomes-conversation", null, CAST).session;
    expect(needsBackup(decided, null, NOW)).toBe(true);

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Saves" }));
    const save = createSave(decided, "Seminar", NOW);
    await user.upload(
      screen.getByLabelText("Import from file"),
      new File([JSON.stringify(save)], "seminar.json", { type: "application/json" }),
    );
    expect(await screen.findByText(/Imported seminar\.json/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Dossier (1)" })).toBeTruthy();
    expect(reminder()).toBeNull();
  });
});
