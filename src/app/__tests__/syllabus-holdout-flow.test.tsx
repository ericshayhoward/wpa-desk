// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("The Syllabus Holdout: meet about outcomes, write Dr. Cherry a record, see her reply and the debrief", async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: /Alan Pruitt and the common syllabus/ }));
  expect(screen.getByText(/Could you take this one\?/)).toBeTruthy();
  expect(screen.getByText(/I've taught composition for twenty-two years/)).toBeTruthy();

  // The program-change option is open at the start, since it needs Dr. Cherry's trust of 60.
  expect((screen.getByRole("button", { name: /Propose common outcomes for everyone/ }) as HTMLButtonElement).disabled).toBe(false);

  await user.click(screen.getByRole("button", { name: /Meet with him about outcomes, not the syllabus/ }));
  await user.click(screen.getByRole("button", { name: /Write a memo/ }));
  await user.type(screen.getByRole("textbox", { name: /The ask, in one sentence/ }), "Keep this agreement on file.");
  await user.type(screen.getByRole("textbox", { name: /Body/ }), "He keeps his readings and adds the portfolio.");
  await user.click(screen.getByRole("button", { name: "Send memo and decide" }));

  expect(screen.getByRole("heading", { name: "You chose: Meet with him about outcomes, not the syllabus" })).toBeTruthy();
  expect(screen.getByText(/You got the portfolio, which is what 102 actually needs/)).toBeTruthy();
  expect(screen.getByText(/Rank and responsibility/)).toBeTruthy();
});
