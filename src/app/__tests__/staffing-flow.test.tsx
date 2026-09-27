// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { resolveUrgent, submitYearEndReport } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("routine staffing: when adjuncts leave, the director decides how to cover the gap, and can teach a section", async () => {
  const user = userEvent.setup();
  render(<App />);
  // Raising caps drives adjuncts away; play until the program comes up short.
  await user.click(screen.getByRole("button", { name: /FYC section caps for spring/ }));
  await user.click(screen.getByRole("button", { name: /Accept the increase/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  await user.click(screen.getByRole("button", { name: "Back to desk" }));
  for (let i = 0; i < 5 && !screen.queryByText(/without an instructor/, { selector: "h2" }); i++) {
    await resolveUrgent(user, { hire: false });
    if (screen.queryByText(/without an instructor/, { selector: "h2" })) break;
    if (screen.queryByText("Submit the year-end report before the term ends.")) await submitYearEndReport(user);
    await user.click(screen.getByRole("button", { name: /advance/i }));
  }
  expect(screen.getByText(/without an instructor/, { selector: "h2" })).toBeTruthy();
  expect(screen.getByText("Decide how to cover the sections without an instructor.")).toBeTruthy();
  // Nothing else can close the term while sections are uncovered: not the advance button, not the report.
  const advance = screen.queryByRole("button", { name: /advance/i }) as HTMLButtonElement | null;
  if (advance) expect(advance.disabled).toBe(true);
  const report = screen.queryByRole("button", { name: /Year-end report/ }) as HTMLButtonElement | null;
  if (report) expect(report.disabled).toBe(true);

  const hoursBefore = Number(screen.getByText(/^\d+ \/ \d+$/).textContent!.split("/")[0]);
  await user.click(screen.getByRole("button", { name: /Teach a section yourself/ }));
  expect(screen.getByText(/You're teaching a section yourself this term/)).toBeTruthy();
  expect(screen.queryByText(/without an instructor/, { selector: "h2" })).toBeNull();
  expect(Number(screen.getByText(/^\d+ \/ \d+$/).textContent!.split("/")[0])).toBe(Math.max(0, hoursBefore - 20));
});
