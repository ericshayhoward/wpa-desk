// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { createSave } from "../../training";
import { avery, blake } from "../../test-fixtures/students";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const file = (name: string, text: string) => new File([text], name, { type: "application/json" });
const saveFile = (name: string, s: ReturnType<typeof avery>) => file(name, JSON.stringify(createSave(s, "Submission", new Date())));

it("instructor review: class overview, by-scenario view, read-only case files, own session untouched", async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getByText("Fall, Year 1")).toBeTruthy();
  const autosaveBefore = localStorage.getItem("wpa-desk:autosave");

  await user.click(screen.getByRole("button", { name: "Instructor review" }));
  await user.upload(screen.getByLabelText("Open student files"), [
    saveFile("avery.json", avery()),
    saveFile("blake.json", blake()),
    file("notes.txt", "not a save"),
  ]);

  // Bad files are reported, good ones load.
  expect(await screen.findByText(/Couldn't open/)).toBeTruthy();
  expect(screen.getByText("notes.txt")).toBeTruthy();

  // Class overview.
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(2);
  expect(within(rows[0]!).getByRole("rowheader").textContent).toBe("Avery ChenENGL 790");
  expect(within(rows[0]!).getByText("Spring, Year 1")).toBeTruthy();
  expect(within(rows[0]!).getByText("0 / 0 / 1")).toBeTruthy();
  expect(within(rows[1]!).getByText("Fall, Year 1")).toBeTruthy();

  // By scenario.
  await user.click(screen.getByRole("button", { name: "By scenario" }));
  const capMemo = screen.getByRole("region", { name: "The Cap Memo" });
  expect(within(capMemo).getByText(/2 of 2 responded/)).toBeTruthy();
  expect(within(capMemo).getByText("Blake Ortiz")).toBeTruthy();
  expect(within(capMemo).getByText("(1 persuaded)")).toBeTruthy();

  // One student's case files, read-only.
  await user.click(screen.getByRole("button", { name: "Class overview" }));
  const averyRow = screen.getAllByRole("row")[1]!; // the table was re-rendered; look it up again
  await user.click(within(averyRow).getByRole("button", { name: "Open case files" }));
  expect(screen.getByRole("heading", { name: "Avery Chen: case files" })).toBeTruthy();
  const caseFile = screen.getByRole("article", { name: "1. The Cap Memo" });
  expect(within(caseFile).getByText("Numbers carried the argument.")).toBeTruthy();
  expect(within(caseFile).getByText("First pass")).toBeTruthy(); // drafting history note
  expect(within(caseFile).queryAllByRole("textbox")).toHaveLength(0);
  expect(within(caseFile).queryByRole("button", { name: /Revise this memo/ })).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Your name" })).toBeNull();

  // Back to the instructor's own desk: session and autosave unchanged.
  await user.click(screen.getByRole("button", { name: "← Back to class overview" }));
  await user.click(screen.getByRole("button", { name: "Back to my desk" }));
  expect(screen.getByText("Fall, Year 1")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Dr. Cherry.*FYC section caps/ })).toBeTruthy();
  expect(localStorage.getItem("wpa-desk:autosave")).toBe(autosaveBefore);
});
