// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { playGame } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("The Late Hire: urgent, blocks the term, resolved by adding seats", async () => {
  const user = userEvent.setup();
  await playGame(user);

  // Leave The Cap Memo for later and move to spring.
  await user.click(screen.getByRole("button", { name: "Leave these for next term and advance" }));
  expect(screen.getByText("Spring, Year 1")).toBeTruthy();
  expect(screen.getByText("3 of 60")).toBeTruthy(); // unstaffed, in the status bar
  // Two urgent items this spring: The Late Hire and The Grade Appeal Escalation.
  expect(screen.getAllByText("urgent")).toHaveLength(2);
  expect((screen.getByRole("button", { name: /advance/i }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/The Grade Appeal Escalation, The Late Hire can't wait/)).toBeTruthy();

  // The email states the real gap.
  await user.click(screen.getByRole("button", { name: /Spring sections without instructors/ }));
  expect(screen.getByText(/no instructor for 3 sections of ENGL 102/)).toBeTruthy();

  // The staffing planner opens on spring with the gap visible.
  await user.click(screen.getByText("Open the staffing planner"));
  expect(screen.getByText("3 of 60 sections have no instructor.")).toBeTruthy();

  // Borrowing colleagues depends on the chair's trust, which hasn't been built yet.
  const borrow = screen.getByRole("button", { name: /Ask the chair to lend tenure-line colleagues/ }) as HTMLButtonElement;
  expect(borrow.disabled).toBe(true);
  expect(screen.getByText("Needs trust of 62 with the English Department Chair (now 60).")).toBeTruthy();
  expect(screen.getByText(/From/).parentElement!.textContent).toContain("Marcus Hale, Chair, Department of English");

  await user.click(screen.getByRole("button", { name: /Add seats to the remaining sections/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByRole("heading", { name: "Projected effect this spring" })).toBeTruthy();
  expect(screen.getByText("ENGL102 cap 24 → 26")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Back to desk" }));
  expect(screen.queryByText("3 of 60")).toBeNull();
  // The staffing crisis no longer blocks the term; the grade appeal and the year-end report still do.
  expect(screen.getByText(/^The Grade Appeal Escalation can't wait/)).toBeTruthy();
  expect(screen.getByText("Submit the year-end report before the term ends.")).toBeTruthy();
});
