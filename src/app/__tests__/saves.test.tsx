// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { playGame } from "./helpers";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS } from "../../content";
import { createSave, startSession } from "../../training";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const advance = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Leave these for next term and advance" }));

describe("saving and loading", () => {
  it("autosaves and resumes after a reload", async () => {
    const user = userEvent.setup();
    const first = await playGame(user);
    await advance(user);
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
    first.unmount();

    // The start screen says where the game was left, and Resume picks it up.
    render(<App />);
    expect(screen.getByText(/^Spring, Year 1 · Assistant Director · 0 decisions$/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
  });

  it("explains a damaged autosave on the start screen, and starts fresh", async () => {
    const user = userEvent.setup();
    localStorage.setItem("wpa-desk:autosave", "{not json");
    render(<App />);
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    expect(screen.getByText(/Couldn't resume your last game \(The saved data is damaged\.\)/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "New game" }));
    expect(screen.getByText("Fall, Year 1")).toBeTruthy();
  });

  it("saves to a slot, starts over, and loads the slot back", async () => {
    const user = userEvent.setup();
    await playGame(user);
    await advance(user); // Spring, Year 1

    await user.click(screen.getByRole("button", { name: "Saves" }));
    expect(screen.getAllByText("Empty")).toHaveLength(3);
    await user.click(screen.getAllByRole("button", { name: "Save here" })[0]!);
    expect(screen.getByText("Saved to slot 1.")).toBeTruthy();
    expect(screen.getByText(/^Spring, Year 1 · 0 decisions · 0 memos · saved/)).toBeTruthy();

    // Start over (two-step confirm).
    await user.click(screen.getByRole("button", { name: "Start a new session" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Fall, Year 1")).toBeTruthy();
    expect(screen.getByText(/Started a new session\./)).toBeTruthy();

    // Load slot 1 back.
    await user.click(screen.getByRole("button", { name: "Saves" }));
    await user.click(screen.getByRole("button", { name: "Load" }));
    expect(screen.getByText("Replace current session?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
    expect(screen.getByText(/Loaded slot 1 \(Spring, Year 1\)\./)).toBeTruthy();
  });

  it("imports a save file, and explains a bad one", async () => {
    const user = userEvent.setup();
    await playGame(user);
    await user.click(screen.getByRole("button", { name: "Saves" }));
    const input = screen.getByLabelText("Import from file") as HTMLInputElement;

    await user.upload(input, new File(["hello"], "notes.txt", { type: "application/json" }));
    expect(await screen.findByText(/isn't valid JSON/)).toBeTruthy();

    const s = startSession(MIDLAND_STATE, SCENARIOS);
    const spring = { ...s, termIndex: 2 };
    const file = new File([JSON.stringify(createSave(spring, "Seminar", new Date()))], "seminar.json", { type: "application/json" });
    await user.upload(input, file);
    expect(await screen.findByText(/Imported seminar\.json \(Spring, Year 1\)\./)).toBeTruthy();
    expect(screen.getByText("Spring, Year 1")).toBeTruthy();
  });
});
