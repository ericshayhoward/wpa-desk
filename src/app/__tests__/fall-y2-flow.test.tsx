// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { playGame, resolveUrgent, submitYearEndReport } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

async function toFallY2() {
  const user = userEvent.setup();
  await playGame(user);
  await user.click(screen.getByRole("button", { name: /advance/i }));
  await resolveUrgent(user);
  await submitYearEndReport(user);
  await user.click(screen.getByRole("button", { name: /advance/i }));
  expect(screen.getByText("Fall, Year 2")).toBeTruthy();
  return user;
}

it("The Accreditation Ask: urgent, answered with paid portfolio readers", async () => {
  const user = await toFallY2();
  expect(screen.getByText(/The Accreditation Ask can't wait/)).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Accreditation visit, evidence for first-year writing/ }));
  expect(screen.getByText(/I'd rather show the team a small real assessment/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Score a sample of portfolios with paid readers/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByText("Program-wide portfolio assessment: no → yes")).toBeTruthy();
  expect(screen.getByText(/Direct and indirect evidence/)).toBeTruthy();
});

it("The Dual-Enrollment Drop: show the dean the spring numbers with a staffing projection", async () => {
  const user = await toFallY2();
  expect(screen.getByText(/surplus/)).toBeTruthy(); // status bar: the drop turned fall into a surplus

  await user.click(screen.getByRole("button", { name: /ENGL 101 enrollment and the instruction line/ }));
  expect(screen.getByText(/running a \$\d[\d,]* surplus/)).toBeTruthy();

  // Save spring's numbers as they stand.
  await user.click(screen.getByText("Open the staffing planner"));
  const planner = within(screen.getByText("Open the staffing planner").closest("details")!);
  await user.click(planner.getByRole("button", { name: "Spring" }));
  await user.click(planner.getByRole("button", { name: "Save this projection as evidence" }));

  await user.click(screen.getByRole("button", { name: /Show the dean the spring numbers/ })); // memo required: opens the composer
  await user.type(screen.getByRole("textbox", { name: /The ask, in one sentence/ }), "Size the cut to both terms.");
  await user.type(screen.getByRole("textbox", { name: /Body/ }), "Spring barely changes.");
  await user.click(screen.getByRole("checkbox", { name: /Staffing plan: no changes \(Spring\)/ }));
  await user.click(screen.getByRole("button", { name: "Send memo and decide" }));

  expect(screen.getByText(/The dean reads the spring numbers twice/)).toBeTruthy();
  expect(screen.getByText(/Seasonal budgets/)).toBeTruthy();
});
