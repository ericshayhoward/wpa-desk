// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { playGame } from "./helpers";
import { HISTORY_NOTICE } from "../../training";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => localStorage.clear());

async function openCounterMemo(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Dr. Cherry.*FYC section caps/ }));
  await user.click(screen.getByRole("button", { name: /Counter with a cost-and-impact memo/ }));
}

it("drafts are kept, survive a reload, and show up in the case file with changes", async () => {
  const user = userEvent.setup();
  const first = await playGame(user);
  await openCounterMemo(user);
  expect(screen.getByText(HISTORY_NOTICE, { exact: false })).toBeTruthy();

  await user.type(screen.getByLabelText("The ask, in one sentence"), "Hold caps at 24.");
  await user.type(screen.getByRole("textbox", { name: /Body/ }), "Caps matter.");
  await user.type(screen.getByRole("textbox", { name: "Revision note" }), "First pass");
  await user.click(screen.getByRole("button", { name: "Save draft" }));
  expect(screen.getByText(/^1 version saved/)).toBeTruthy();
  first.unmount();

  // Reload: reopening the scenario goes straight back into the half-written memo.
  await playGame(user);
  await user.click(screen.getByRole("button", { name: /Dr. Cherry.*FYC section caps/ }));
  expect(screen.queryByRole("heading", { name: "How do you respond?" })).toBeNull();
  expect((screen.getByRole("textbox", { name: /Body/ }) as HTMLTextAreaElement).value).toBe("Caps matter.");
  expect(screen.getByText(/^1 version saved/)).toBeTruthy();

  await user.type(screen.getByRole("textbox", { name: /Body/ }), " Class size drives feedback time.");
  await user.click(screen.getByRole("button", { name: "Send memo and decide" }));
  await user.click(screen.getByRole("button", { name: "See the case file" }));

  const file = screen.getByRole("article", { name: "1. The Cap Memo" });
  const rows = within(file).getAllByRole("row");
  expect(rows.map((r) => r.textContent)).toEqual([
    "#WhenEventWordsNote",
    expect.stringMatching(/^1.*Saved draft2First pass$/),
    expect.stringMatching(/^2.*Sent7 \(\+5\)$/),
  ]);
  expect(within(file).getByText("Class size drives feedback time.", { selector: "ins", exact: false })).toBeTruthy();

  // Revise for the portfolio; the sent version stays.
  await user.click(within(file).getByRole("button", { name: "Revise this memo for your portfolio" }));
  const revised = within(file).getByRole("textbox", { name: "Revised body" });
  await user.clear(revised);
  await user.type(revised, "Caps drive feedback time.");
  await user.type(within(file).getByRole("textbox", { name: /Revision note: what did you change/ }), "Tightened");
  await user.click(within(file).getByRole("button", { name: "Save revision" }));
  expect(within(file).getByRole("heading", { name: "Portfolio revision" })).toBeTruthy();
  expect(within(file).getByText(/Revised after sending\. The version above is what Dean Alvarez received\./)).toBeTruthy();
  expect(within(file).getByText("Caps matter. Class size drives feedback time.")).toBeTruthy();
});

it("a pause in writing takes a snapshot automatically", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await playGame(user);
  await openCounterMemo(user);
  await user.type(screen.getByRole("textbox", { name: /Body/ }), "Thinking out loud");
  expect(screen.getByText(/^No versions saved yet\./)).toBeTruthy();
  await act(async () => {
    vi.advanceTimersByTime(21_000);
  });
  expect(screen.getByText(/^1 version saved/)).toBeTruthy();
});
