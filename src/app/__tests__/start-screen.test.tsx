// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS, STANDARD_ARC } from "../../content";
import { createSave, startSession } from "../../training";
import { playGame } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("the start screen", () => {
  it("offers the game, the planning tools, and instructor review, with no Resume on a first visit", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Plan" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Teach" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    expect(screen.getByRole("button", { name: "New game" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Guide for instructors" })).toBeTruthy();
    expect(screen.getByText(/nothing you enter is sent anywhere/)).toBeTruthy();
    // No game yet, so nothing is saved.
    expect(localStorage.getItem("wpa-desk:autosave")).toBeNull();
  });

  it("leaves the game for Home and comes back with Resume", async () => {
    const user = userEvent.setup();
    await playGame(user);
    await user.click(screen.getByRole("button", { name: "Leave these for next term and advance" }));
    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByText(/^Spring, Year 1 · Assistant Director · 0 decisions$/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
  });

  it("asks before a new game replaces the saved one", async () => {
    const user = userEvent.setup();
    const first = await playGame(user);
    await user.click(screen.getByRole("button", { name: "Leave these for next term and advance" }));
    first.unmount();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "New game" }));
    const ask = screen.getByRole("group", { name: "Start a new game" });
    expect(within(ask).getByText(/replaces the one saved in this browser/)).toBeTruthy();
    await user.click(within(ask).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "New game" }));
    await user.click(screen.getByRole("button", { name: "Start a new game" }));
    expect(screen.getByText("Fall, Year 1")).toBeTruthy();
  });

  it("opens a save file, and explains a bad one", async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = screen.getByLabelText("Open a save file") as HTMLInputElement;

    await user.upload(input, new File(["hello"], "notes.txt", { type: "application/json" }));
    expect(await screen.findByText(/isn't valid JSON/)).toBeTruthy();

    const spring = { ...startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), termIndex: 2 };
    const file = new File([JSON.stringify(createSave(spring, "Seminar", new Date()))], "seminar.json", { type: "application/json" });
    await user.upload(input, file);
    expect(await screen.findByText(/Opened seminar\.json \(Spring, Year 1\)\./)).toBeTruthy();
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
  });
});

describe("the planning tools", () => {
  it("run outside the game on the sample program, with staffing and workload charts", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Open planning tools" }));

    // No game: no session saved, no game stats.
    expect(localStorage.getItem("wpa-desk:autosave")).toBeNull();
    expect(screen.queryByText("Political capital")).toBeNull();
    expect(screen.getByText("Midland State University")).toBeTruthy();
    expect(screen.getByText("What-if only: nothing here is saved, so try anything.")).toBeTruthy();

    // Capacity: groups fill in order, so adjuncts take what's left.
    expect(screen.getByText("All 60 sections are staffed.")).toBeTruthy();
    expect(screen.getByText("36 of 42")).toBeTruthy();
    expect(screen.getByText("15 of 15")).toBeTruthy();

    // Workload: lecturers and adjuncts teach 3 sections at an average of 23 students, against 20 a section;
    // tenure-track faculty and GTAs teach one.
    expect(screen.getAllByText("69 students")).toHaveLength(2);
    expect(screen.getAllByText(", 9 over the recommended 60")).toHaveLength(2);
    expect(screen.getAllByText(/^About 115 hours/)).toHaveLength(2);
    expect(screen.getAllByText(", 3 over the recommended 20")).toHaveLength(2);

    // Three adjuncts leave: the gap shows up as its own row, and the bar says what it was.
    const adjuncts = screen.getByRole("spinbutton", { name: "Adjunct faculty: people" });
    await user.clear(adjuncts);
    await user.type(adjuncts, "11");
    expect(screen.getByText("33 of 33")).toBeTruthy();
    expect(screen.getByText("(now 36)")).toBeTruthy();
    expect(screen.getByText("3 sections")).toBeTruthy();

    // The cap calculator's workload chart follows the caps.
    await user.click(screen.getByRole("button", { name: "Class cap calculator" }));
    const engl101 = screen.getAllByRole("spinbutton")[0]!;
    await user.clear(engl101);
    await user.type(engl101, "20");
    expect(screen.getByText(/^Projected D\/F\/W$/)).toBeTruthy();
    expect(screen.queryByText(", 9 over the recommended 60")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("heading", { name: "Plan" })).toBeTruthy();
  });
});
