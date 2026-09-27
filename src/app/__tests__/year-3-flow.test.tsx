// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { resolveUrgent, submitYearEndReport } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("Year 3: the stipend campaign, the budget swap, and the handoff, as interim director", async () => {
  const user = userEvent.setup();
  render(<App />);
  for (const term of ["Spring, Year 1", "Fall, Year 2", "Spring, Year 2", "Fall, Year 3"]) {
    await resolveUrgent(user);
    if (screen.queryByText("Submit the year-end report before the term ends.")) await submitYearEndReport(user);
    await user.click(screen.getByRole("button", { name: /advance/i }));
    expect(screen.getByText(term)).toBeTruthy();
  }
  expect(screen.getByText("Interim Director")).toBeTruthy();

  // The stipend campaign: recuse.
  await user.click(screen.getByRole("button", { name: /An open letter from Midland's graduate instructors/ }));
  expect(screen.getByText(/We are paid \$9,000 for each/)).toBeTruthy();
  expect(screen.getByText(/I'd advise you not to take a public position/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Recuse yourself and ask Dr. Hale to respond/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByText(/Roles and conflicts/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back to desk" }));

  // The budget swap blocks the term; take the cut from the instruction line.
  expect(screen.getByText(/The Writing Center Budget Swap can't wait/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Writing support budget for next year/ }));
  await user.click(screen.getByRole("button", { name: /Take the cut from the instruction line/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByText(/I know what this costs your program/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back to desk" }));

  await user.click(screen.getByRole("button", { name: /advance/i }));
  expect(screen.getByText("Spring, Year 3")).toBeTruthy();

  // The handoff: write the handbook, then the capstone ends the arc.
  await user.click(screen.getByRole("button", { name: /Next year's assistant director/ }));
  await user.click(screen.getByRole("button", { name: /Write a handbook for the job/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByText(/This is the handbook I wish I'd had/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back to desk" }));

  await submitYearEndReport(user);
  expect(screen.getByText("The end of the arc")).toBeTruthy();
});
