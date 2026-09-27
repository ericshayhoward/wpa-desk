// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

async function openCapMemo() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /FYC section caps for next fall/ }));
  return user;
}

describe("cap calculator explains changes that do nothing", () => {
  it("spring ENGL101 at 26: labeled what-if, shows rounding, explains why", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Tools" }));
    expect(screen.getByText(/What-if only: this doesn't change your program/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Spring" }));
    const input = screen.getByRole("spinbutton", { name: /^ENGL101\b/ });
    await user.clear(input);
    await user.type(input, "26");

    expect(screen.getByRole("note").textContent).toMatch(/A cap of 27 would be needed to drop one section/);
    expect(screen.getByText(/\(9\.2, rounded up\)/)).toBeTruthy();
    expect(screen.getByText("$8,600 deficit")).toBeTruthy(); // status bar unchanged by what-ifs
  });
});

describe("playing The Cap Memo through the UI", () => {
  it("shows the starting deficit and the dean's memo in the inbox", async () => {
    render(<App />);
    expect(screen.getByText("$8,600 deficit")).toBeTruthy();
    expect(screen.getByText("Fall, Year 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dr. Cherry.*FYC section caps/ })).toBeTruthy();
    // The People card names the characters and shows what moves them.
    expect(screen.getByText("Elena Alvarez")).toBeTruthy();
    expect(screen.getByText("Chair, Department of English")).toBeTruthy();
    expect(screen.getByLabelText("Adjunct faculty morale")).toBeTruthy();
  });

  it("accept: decide without a memo, see the outcome and debrief", async () => {
    const user = await openCapMemo();
    expect(screen.getByText(/I'd like to raise caps in ENGL 101 and ENGL 102/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Accept the increase/ }));
    await user.click(screen.getByRole("button", { name: "Decide without a memo" }));

    expect(screen.getByRole("heading", { name: "You chose: Accept the increase" })).toBeTruthy();
    expect(screen.getByText(/Thank you for being a team player/)).toBeTruthy();
    expect(screen.getByText(/Something from it will come back in 2 terms/)).toBeTruthy();
    expect(screen.getByText(/Who actually bears the savings/)).toBeTruthy();

    // Back at the desk, the budget is now in surplus and the inbox is empty.
    await user.click(screen.getByRole("button", { name: "Back to desk" }));
    expect(screen.getByText("$9,400 surplus")).toBeTruthy();
    expect(screen.getByText("Nothing waiting on you this term.")).toBeTruthy();

    // Two terms later, the delayed consequence lands.
    await user.click(screen.getByRole("button", { name: /Advance to Spring, Year 1/ }));
    await user.click(screen.getByRole("button", { name: /Advance to Fall, Year 2/ }));
    expect(screen.getByRole("heading", { name: "Since last term" })).toBeTruthy();
    expect(screen.getByText(/Two experienced instructors take work elsewhere/)).toBeTruthy();
  });

  it("counter-with-data: run the calculator, save evidence, attach it, persuade the dean", async () => {
    const user = await openCapMemo();

    // Use the tool: raise both caps to 27 and save the comparison.
    await user.click(screen.getByText("Open the class cap calculator"));
    for (const course of ["ENGL101", "ENGL102"]) {
      const input = screen.getByRole("spinbutton", { name: new RegExp(`^${course}\\b`) });
      await user.clear(input);
      await user.type(input, "27");
    }
    await user.click(screen.getByRole("button", { name: "Save this comparison as evidence" }));
    expect(screen.getByText(/Saved: Cap analysis: ENGL101 24→27, ENGL102 24→27/)).toBeTruthy();

    // Choosing a memo-required option opens the composer directly.
    await user.click(screen.getByRole("button", { name: /Counter with a cost-and-impact memo/ }));
    const send = screen.getByRole("button", { name: "Send memo and decide" });
    expect(screen.getByText(/Dean Alvarez responds to:/)).toBeTruthy();
    expect(screen.getByText(/Trust now: 55\. With the evidence Dean Alvarez needs, 30 is enough ✓\. Without it, you'd need 90\./)).toBeTruthy();
    expect((send as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("The ask, in one sentence"), "Hold caps at 24 for one year.");
    await user.click(screen.getByRole("checkbox", { name: /Cap analysis/ }));
    await user.click(screen.getByRole("button", { name: "Quote in body" }));
    await user.type(screen.getByRole("textbox", { name: /Body/ }), " I recommend holding caps.");
    await user.click(screen.getByRole("button", { name: "+ Add a commitment" }));
    await user.type(screen.getByRole("textbox", { name: "Commitment 1" }), "Share D/F/W data by next fall");
    await user.click(screen.getByRole("checkbox", { name: /Claims are backed by data/ }));
    await user.click(send);

    expect(
      screen.getByText("Your memo carried the evidence Dean Alvarez needed, and the relationship could bear it (trust 55; 30 needed)."),
    ).toBeTruthy();
    expect(screen.getByText(/Your numbers make a stronger case than I expected/)).toBeTruthy();

    // Reflect right after the debrief; it goes into the case file.
    await user.type(screen.getByRole("textbox", { name: "Reflection on The Cap Memo" }), "Numbers mattered more than I expected.");
    await user.click(screen.getByRole("button", { name: "Save reflection" }));
    expect(screen.getByText("Saved to your case file.")).toBeTruthy();

    // The case file has the whole story: what arrived, the decision, the memo, what happened, the reflection.
    await user.click(screen.getByRole("button", { name: "See the case file" }));
    const filed = screen.getByRole("article", { name: "1. The Cap Memo" });
    // The dean appears twice: sender of the memo you received, recipient of yours.
    expect(within(filed).getAllByText(/Elena Alvarez, Dean of Arts & Sciences/)).toHaveLength(2);
    expect(within(filed).getByText(/I'd like to raise caps in ENGL 101 and ENGL 102/)).toBeTruthy();
    expect(within(filed).getByText("Counter with a cost-and-impact memo.")).toBeTruthy();
    expect(within(filed).getByText(/Hold caps at 24 for one year/)).toBeTruthy();
    expect(within(filed).getByText("Evidence attached")).toBeTruthy();
    expect(within(filed).getByText(/Share D\/F\/W data by next fall — open, due Fall, Year 2/)).toBeTruthy();
    expect(within(filed).getByText(/Your numbers make a stronger case than I expected/)).toBeTruthy();
    expect(
      (within(filed).getByRole("textbox", { name: "Reflection on The Cap Memo" }) as HTMLTextAreaElement).value,
    ).toBe("Numbers mattered more than I expected.");

    // Cover details persist.
    await user.type(screen.getByRole("textbox", { name: "Your name" }), "Jordan Lee");
    await user.click(screen.getByRole("button", { name: "Save cover details" }));
    expect(screen.getByText("Jordan Lee", { selector: ".cover p" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Desk" }));
    expect(screen.getByText("Balanced")).toBeTruthy();

    // The commitment waits on the desk, and can be delivered early for its effort.
    expect(screen.getByRole("heading", { name: "Commitments" })).toBeTruthy();
    expect(screen.getByText("Share D/F/W data by next fall")).toBeTruthy();
    expect(screen.getByText("To Dean Alvarez · 4 admin hours")).toBeTruthy();
    expect(screen.getByText("54 / 60")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Deliver early" }));
    expect(screen.getByText("50 / 60")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Commitments" })).toBeNull();
  });

  it("counter-with-data without evidence: the dean isn't persuaded", async () => {
    const user = await openCapMemo();
    await user.click(screen.getByRole("button", { name: /Counter with a cost-and-impact memo/ }));
    await user.type(screen.getByLabelText("The ask, in one sentence"), "Hold caps at 24.");
    await user.type(screen.getByRole("textbox", { name: /Body/ }), "CCCC recommends no more than 20 students.");
    await user.click(screen.getByRole("button", { name: "Send memo and decide" }));

    expect(screen.getByText(/Dean Alvarez doesn't know you well enough to take your word for it \(trust 55; 90 needed without evidence\)/)).toBeTruthy();
    expect(screen.getByText(/I need numbers I can take to the provost/)).toBeTruthy();
  });
});
