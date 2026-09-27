// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

it("The Grade Appeal Escalation: urgent in spring, routed through the appeal process with a memo to Okafor", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Leave these for next term and advance" }));
  expect(screen.getByText("Spring, Year 1")).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Grade complaint: I'm at CCCC/ }));
  expect(screen.getByText(/look at\s+the late policy in the common syllabus/)).toBeTruthy();
  expect(screen.getByText(/I will\s+be contacting the board of trustees/)).toBeTruthy();

  await user.click(screen.getByRole("button", { name: /Route it through the appeal process/ }));
  await user.click(screen.getByRole("button", { name: /Write a memo/ }));
  await user.type(screen.getByRole("textbox", { name: /The ask, in one sentence/ }), "Let the appeal process run.");
  await user.type(screen.getByRole("textbox", { name: /Body/ }), "We can't discuss the record with a parent without consent.");
  await user.click(screen.getByRole("button", { name: "Send memo and decide" }));

  expect(screen.getByRole("heading", { name: "You chose: Route it through the appeal process" })).toBeTruthy();
  expect(screen.getByText(/Dylan passes with a C−/)).toBeTruthy();
  expect(screen.getByText(/Who owns the record/)).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "Back to desk" }));
  expect(screen.queryByText(/The Grade Appeal Escalation can't wait/)).toBeNull();
});
