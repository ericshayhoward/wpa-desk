// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { playGame } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("staffing planner: a late gap, overloads, then a cancellation", async () => {
  const user = userEvent.setup();
  await playGame(user);
  await user.click(screen.getByRole("button", { name: "Tools" }));
  await user.click(screen.getByRole("button", { name: "Staffing planner" }));

  expect(screen.getByText("All 60 sections are staffed.")).toBeTruthy();
  expect(screen.getByText(/caps adjuncts at three sections a term/)).toBeTruthy();

  // Three adjuncts leave: three sections open.
  const adjuncts = screen.getByRole("spinbutton", { name: "Adjunct faculty: people" });
  await user.clear(adjuncts);
  await user.type(adjuncts, "11");
  expect(screen.getByText("3 of 60 sections have no instructor.")).toBeTruthy();
  expect(screen.getByText("Lose 3 adjunct faculty (14 → 11)")).toBeTruthy();

  // Ask lecturers for one overload each: two sections covered, one still open.
  const overloads = screen.getByRole("spinbutton", { name: "Full-time non-tenure-track: overloads per person" });
  await user.clear(overloads);
  await user.type(overloads, "1");
  expect(screen.getByText("1 of 60 sections has no instructor.")).toBeTruthy();
  expect(screen.getByText("2 of 2")).toBeTruthy();

  // Cancel one Composition I section.
  const cancel = screen.getByRole("spinbutton", { name: /ENGL101\b.*needed/ });
  await user.clear(cancel);
  await user.type(cancel, "1");
  expect(screen.getByText("All 59 sections are staffed.")).toBeTruthy();
  expect(screen.getByText(/1 cancelled; 24 students without a seat\./)).toBeTruthy();

  // What-if only: the program itself is untouched.
  await user.click(screen.getByRole("button", { name: "Reset to current staffing" }));
  expect(screen.getByText("All 60 sections are staffed.")).toBeTruthy();
});
