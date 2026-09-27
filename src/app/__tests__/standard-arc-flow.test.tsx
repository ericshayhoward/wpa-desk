// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("playing the standard arc through the UI", () => {
  it("starts as assistant director, becomes interim director in Year 3, and stops at Spring, Year 3", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText("Assistant Director")).toBeTruthy();

    // Dr. Cherry forwards the dean's memo and asks you to draft the reply.
    await user.click(screen.getByRole("button", { name: /Dr. Cherry.*Fwd: FYC section caps/ }));
    expect(screen.getByText(/I'd like you to take the lead on this one/)).toBeTruthy();
    expect(screen.getByText(/I'd like to raise caps in ENGL 101 and ENGL 102/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Accept the increase/ }));
    await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
    await user.click(screen.getByRole("button", { name: "Back to desk" }));

    // Raising caps drives adjuncts away, so The Late Hire arrives in Spring,
    // Year 2 and has to be handled before the term can end.
    for (const term of ["Spring, Year 1", "Fall, Year 2", "Spring, Year 2", "Fall, Year 3"]) {
      if (screen.queryByText(/The Late Hire can't wait/)) {
        await user.click(screen.getByRole("button", { name: /Spring sections without instructors/ }));
        await user.click(screen.getByRole("button", { name: /Cancel the uncovered sections/ }));
        await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
        await user.click(screen.getByRole("button", { name: "Back to desk" }));
      }
      await user.click(screen.getByRole("button", { name: new RegExp(`Advance to ${term}`) }));
    }
    expect(screen.getByText("Interim Director")).toBeTruthy();
    expect(screen.getByText(/Dr. Cherry begins her sabbatical/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Advance to Spring, Year 3/ }));
    expect(screen.getByText(/Spring, Year 3 is the final term of The Standard Arc/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Advance to/ })).toBeNull();
  });
});
