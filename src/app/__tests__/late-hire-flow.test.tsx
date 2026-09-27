// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("The Late Hire: urgent, blocks the term, resolved by adding seats", async () => {
  const user = userEvent.setup();
  render(<App />);

  // Leave The Cap Memo for later and move to spring.
  await user.click(screen.getByRole("button", { name: "Leave these for next term and advance" }));
  expect(screen.getByText("Spring, Year 1")).toBeTruthy();
  expect(screen.getByText("3 of 60")).toBeTruthy(); // unstaffed, in the status bar
  expect(screen.getByText("urgent")).toBeTruthy();
  expect((screen.getByRole("button", { name: /advance/i }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/The Late Hire can't wait/)).toBeTruthy();

  // The email states the real gap.
  await user.click(screen.getByRole("button", { name: /Spring sections without instructors/ }));
  expect(screen.getByText(/no instructor for 3 sections of ENGL 102/)).toBeTruthy();

  // The staffing planner opens on spring with the gap visible.
  await user.click(screen.getByText("Open the staffing planner"));
  expect(screen.getByText("3 of 60 sections have no instructor.")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Add seats to the remaining sections/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  expect(screen.getByRole("heading", { name: "Projected effect this spring" })).toBeTruthy();
  expect(screen.getByText("ENGL102 cap 24 → 26")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Back to desk" }));
  expect(screen.queryByText("3 of 60")).toBeNull();
  expect((screen.getByRole("button", { name: /advance/i }) as HTMLButtonElement).disabled).toBe(false);
});
