import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";

/** Writes every section that's the player's in the due year-end report, submits it, and returns to the desk. */
export async function submitYearEndReport(user: UserEvent, text = "The numbers show a steady program.") {
  await user.click(screen.getByRole("button", { name: /annual report|Year-end report/i }));
  for (const box of screen.getAllByRole("textbox")) {
    if (box.tagName === "TEXTAREA") await user.type(box, text);
  }
  await user.click(screen.getByRole("button", { name: /Submit the report/ }));
  const back = screen.queryByRole("button", { name: "Back to desk" });
  if (back) await user.click(back);
}

/** Urgent scenarios that playthroughs meet along the way, and a quick way through each. */
const URGENT: [subject: RegExp, option: RegExp][] = [
  [/Grade complaint: I'm at CCCC/, /Route it through the appeal process/],
  [/Spring sections without instructors/, /Cancel the uncovered sections/],
  [/Accreditation visit, evidence for first-year writing/, /Report grades and D\/F\/W rates/],
];

/** Resolves any urgent scenario waiting in the inbox (without a memo), returning to the desk each time. */
export async function resolveUrgent(user: UserEvent) {
  for (const [subject, option] of URGENT) {
    const item = screen.queryByRole("button", { name: subject });
    if (!item) continue;
    await user.click(item);
    await user.click(screen.getByRole("button", { name: option }));
    await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
    await user.click(screen.getByRole("button", { name: "Back to desk" }));
  }
}
