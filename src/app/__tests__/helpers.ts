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

/** If The Grade Appeal Escalation is waiting (it's urgent in spring), resolve it through the appeal process. */
export async function resolveGradeAppeal(user: UserEvent) {
  const item = screen.queryByRole("button", { name: /Grade complaint: I'm at CCCC/ });
  if (!item) return;
  await user.click(item);
  await user.click(screen.getByRole("button", { name: /Route it through the appeal process/ }));
  await user.click(screen.getByRole("button", { name: "Decide without a memo" }));
  await user.click(screen.getByRole("button", { name: "Back to desk" }));
}
