// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { resolveUrgent, submitYearEndReport } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

/** Compromise at 25 in The Cap Memo, then play through to Spring, Year 2. */
async function toSpringY2() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /FYC section caps for spring/ }));
  await user.click(screen.getByRole("button", { name: /Propose a compromise at 25/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  await user.click(screen.getByRole("button", { name: "Back to desk" }));
  for (const term of ["Spring, Year 1", "Fall, Year 2", "Spring, Year 2"]) {
    await resolveUrgent(user);
    if (screen.queryByText("Submit the year-end report before the term ends.")) await submitYearEndReport(user);
    await user.click(screen.getByRole("button", { name: /advance/i }));
    expect(screen.getByText(term)).toBeTruthy();
  }
  return user;
}

it("Spring, Year 2: the Cap Review returns for a player who compromised, alongside DSP and the detector", async () => {
  const user = await toSpringY2();
  expect(screen.getByText(/The Cap Review can't wait/)).toBeTruthy();
  expect(screen.getByRole("button", { name: /Directed self-placement pilot, one-year results/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /AI detection pilot in first-year writing/ })).toBeTruthy();

  // The Cap Review: settle at 25.
  await user.click(screen.getByRole("button", { name: /Section caps for fall.*The Cap Review/ }));
  expect(screen.getByText(/Last year, I agreed to keep first-year writing caps below 27/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Settle at 25/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByText(/Twenty-five it is/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back to desk" }));

  // The DSP Pilot: adopt with writing center support.
  await user.click(screen.getByRole("button", { name: /Directed self-placement pilot, one-year results/ }));
  expect(screen.getByText(/Satisfaction with placement: 86% \(pilot\)/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Adopt DSP with embedded writing center support/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByText("Placement: test scores → directed self-placement")).toBeTruthy();
  expect(screen.getByText(/Placement and support are one decision/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back to desk" }));

  // The Detector: decline and write guidance.
  await user.click(screen.getByRole("button", { name: /AI detection pilot in first-year writing/ }));
  await user.click(screen.getByRole("button", { name: /Decline the pilot and write program guidance instead/ }));
  await user.type(screen.getByRole("textbox", { name: /The ask, in one sentence/ }), "Use program guidance, not a detector.");
  await user.type(screen.getByRole("textbox", { name: /Body/ }), "Detectors flag multilingual writers more often.");
  await user.click(screen.getByRole("button", { name: "Send memo and decide" }));
  expect(screen.getByText("AI policy: each instructor's choice → program guidance")).toBeTruthy();
  expect(screen.getByText(/Reliability and bias/)).toBeTruthy();
});
