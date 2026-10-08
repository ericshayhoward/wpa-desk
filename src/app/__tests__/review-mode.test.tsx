// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../App";
import { playGame } from "./helpers";
import { createSave } from "../../training";
import { avery, blake } from "../../test-fixtures/students";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const file = (name: string, text: string) => new File([text], name, { type: "application/json" });
const saveFile = (name: string, s: ReturnType<typeof avery>) => file(name, JSON.stringify(createSave(s, "Submission", new Date())));

it("instructor review: class overview, by-scenario view, read-only case files, own session untouched", async () => {
  const user = userEvent.setup();
  await playGame(user);
  expect(screen.getByText("Fall, Year 1")).toBeTruthy();
  // The session, not the whole save: resuming re-saves it with a new time.
  const savedSession = () => JSON.parse(localStorage.getItem("wpa-desk:autosave")!).session;
  const sessionBefore = savedSession();

  // Instructor review opens from the start screen.
  await user.click(screen.getByRole("button", { name: "Home" }));
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
  await user.click(screen.getByRole("button", { name: "Back to class overview" }));
  await user.click(screen.getByRole("button", { name: "Home" }));
  await user.click(screen.getByRole("button", { name: "Resume" }));
  expect(screen.getByText("Fall, Year 1")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Dr. Cherry.*FYC section caps/ })).toBeTruthy();
  expect(savedSession()).toEqual(sessionBefore);
});

it("instructor review links the guide for instructors and asks teachers to say they use it", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Instructor review" }));

  const guide = screen.getByRole("link", { name: "guide for instructors" });
  expect(guide.getAttribute("href")).toBe("https://ericshayhoward.com/projects/wpa-desk/teaching/");
  // No analytics, so an email is how Eric hears about classes.
  const tell = screen.getByRole("link", { name: "Let Eric know" }).getAttribute("href")!;
  expect(tell.startsWith("mailto:helloeshoward@gmail.com?subject=Using%20WPA%20Desk%20in%20a%20course&body=")).toBe(true);
  expect(decodeURIComponent(tell.split("body=")[1]!)).toContain("About how many students:");
});
