// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { App } from "../App";
import { MIDLAND_STATE } from "../../model";
import { SCENARIOS, STANDARD_ARC } from "../../content";
import { createSave, startSession } from "../../training";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
beforeEach(() => localStorage.clear());

async function openYourProgram(user: UserEvent) {
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: "Open planning tools" }));
  await user.click(screen.getByRole("button", { name: "Your program" }));
  return view;
}

async function fill(user: UserEvent, field: HTMLElement, value: string) {
  await user.clear(field);
  await user.type(field, value);
}

const group = (name: RegExp | string) => within(screen.getByRole("group", { name }));
const tab = (name: string) => screen.getByRole("button", { name });

/** A one-course program: 100 fall seats at a cap of 20 is 5 sections, and two adjuncts can teach 6. */
async function enterSmallProgram(user: UserEvent) {
  await fill(user, screen.getByLabelText("Institution name"), "Lakeview College");
  await fill(user, screen.getByLabelText("Instruction budget per term"), "20000");
  const course = group(/^Course 1/);
  await fill(user, course.getByLabelText("Course code"), "WRIT101");
  await fill(user, course.getByLabelText("Title"), "College Writing");
  await fill(user, course.getByLabelText("Fall seats needed"), "100");
  await fill(user, course.getByLabelText("Spring seats needed"), "50");
  await fill(user, course.getByLabelText("Cap per section"), "20");
  await fill(user, course.getByLabelText("D/F/W rate"), "15");
  await fill(user, course.getByLabelText("Average section size then"), "20");
  await user.click(screen.getByRole("button", { name: "Add adjunct faculty" }));
  const adjuncts = group("Adjunct faculty");
  await fill(user, adjuncts.getByLabelText("People"), "2");
  await fill(user, adjuncts.getByLabelText("Sections each per term"), "3");
  await fill(user, adjuncts.getByLabelText("Pay per section"), "4000");
}

/** The numbers the small program should show in the staffing planner, with feedback at 90–150 minutes. */
function expectSmallProgramNumbers() {
  expect(screen.getByText("Lakeview College")).toBeTruthy();
  expect(screen.getByText("All 5 sections are staffed.")).toBeTruthy();
  expect(screen.getByText("5 of 6")).toBeTruthy();
  const results = within(screen.getAllByRole("table")[1]!);
  expect(results.getByRole("row", { name: /^Program instruction cost \$20,000 \$20,000/ })).toBeTruthy();
  expect(results.getByRole("row", { name: /^Budget balance \$0 \$0/ })).toBeTruthy();
  expect(screen.getByText("60 students")).toBeTruthy();
  expect(screen.getByText(", within the recommended 60")).toBeTruthy();
  expect(screen.getByText(/^About 120 hours/)).toBeTruthy();
  expect(screen.getByText("(90–150)")).toBeTruthy();
}

describe("your own program in the planning tools", () => {
  it("is entered, runs the tools, exports, and imports back with the same numbers", async () => {
    let exported: Blob | undefined;
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn((b: Blob) => {
          exported = b;
          return "blob:program";
        }),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    const first = await openYourProgram(user);

    // A blank start doesn't open on a wall of errors, and the tools wait for complete data.
    await user.click(screen.getByRole("button", { name: "Start blank" }));
    expect(screen.getByText(/The planning tools open once everything is filled in\./)).toBeTruthy();
    expect(screen.queryByText("Needs a value.")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show what's missing" }));
    expect(screen.getAllByText("Needs a value.").length).toBeGreaterThan(5);
    await user.click(tab("Staffing planner"));
    expect(screen.getByText("The tools open once your program's data is complete.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Finish your program data" }));

    await enterSmallProgram(user);
    expect(screen.getByText(/^Complete, and saved in this browser\./)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("wpa-desk:program")!).program.institution).toBe("Lakeview College");

    // Inline validation names the problem beside the field, and the tools keep the last complete version.
    const course = group(/^Course 1: WRIT101/);
    await fill(user, course.getByLabelText("D/F/W rate"), "150");
    expect(course.getByText("Must be from 0% to 100%.")).toBeTruthy();
    expect(course.getByLabelText("D/F/W rate").getAttribute("aria-invalid")).toBe("true");
    await user.click(tab("Staffing planner"));
    expect(screen.getByText(/Program data has 1 field still to fix/)).toBeTruthy();
    expect(screen.getByText("All 5 sections are staffed.")).toBeTruthy();
    await user.click(tab("Program data"));
    await fill(user, group(/^Course 1/).getByLabelText("D/F/W rate"), "15");

    // The tools run on it, with the default feedback assumption: 60 students × 100 minutes.
    await user.click(tab("Staffing planner"));
    expect(screen.getByText("All 5 sections are staffed.")).toBeTruthy();
    expect(screen.getByText("5 of 6")).toBeTruthy();
    expect(screen.getByText(/^About 100 hours/)).toBeTruthy();
    // What-ifs move the charts and tables: one adjunct leaves.
    const people = screen.getByRole("spinbutton", { name: "Adjunct faculty: people" });
    await fill(user, people, "1");
    expect(screen.getByText("2 of 5 sections have no instructor.")).toBeTruthy();
    expect(screen.getByText("3 of 3")).toBeTruthy();
    expect(screen.getByText("2 sections")).toBeTruthy();

    // Local assumptions replace the defaults and are marked as local data.
    await user.click(tab("Program data"));
    const feedback = group("Feedback time per student per term");
    await user.click(feedback.getByRole("checkbox", { name: "Use this program's own numbers" }));
    await fill(user, feedback.getByLabelText("Value"), "120");
    await fill(user, feedback.getByLabelText("Low end"), "90");
    await fill(user, feedback.getByLabelText("High end"), "150");
    await fill(user, feedback.getByLabelText("Source (optional)"), "Our 2025 instructor survey");
    expect(feedback.getByText("local-data")).toBeTruthy();
    await user.click(tab("Staffing planner"));
    expectSmallProgramNumbers();
    expect(screen.getByText("local-data")).toBeTruthy();
    await user.click(tab("Class cap calculator"));
    expect(screen.getByText(/Source: Our 2025 instructor survey/)).toBeTruthy();

    // Export a file.
    await user.click(tab("Program data"));
    await user.click(screen.getByRole("button", { name: "Export program file" }));
    expect(screen.getByText(/^Exported wpa-desk-program-lakeview-college-\d{4}-\d{2}-\d{2}\.json\.$/)).toBeTruthy();
    const text = await exported!.text();
    expect(JSON.parse(text)).toMatchObject({ format: "wpa-desk-program", version: 1 });

    // Clear storage: the planner is back to the sample, with nothing to resume.
    first.unmount();
    localStorage.clear();
    const user2 = userEvent.setup();
    await openYourProgram(user2);
    expect(screen.getByRole("button", { name: "Start blank" })).toBeTruthy();

    // Import the file back: the same numbers.
    await user2.upload(screen.getByLabelText("Import a program file"), new File([text], "lakeview.json", { type: "application/json" }));
    expect(await screen.findByText("Imported lakeview.json.")).toBeTruthy();
    expect((screen.getByLabelText("Institution name") as HTMLInputElement).value).toBe("Lakeview College");
    await user2.click(tab("Staffing planner"));
    expectSmallProgramNumbers();
  });

  it("starts from a copy of the sample, and opens on it next time", async () => {
    const user = userEvent.setup();
    const first = await openYourProgram(user);
    await user.click(screen.getByRole("button", { name: "Start from a copy of the sample" }));
    expect((screen.getByLabelText("Institution name") as HTMLInputElement).value).toBe("Midland State University (copy)");
    await user.click(tab("Staffing planner"));
    expect(screen.getByText("All 60 sections are staffed.")).toBeTruthy();
    expect(screen.queryByText("sample program")).toBeNull();
    first.unmount();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Open planning tools" }));
    expect(screen.getByRole("button", { name: "Your program" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Midland State University (copy)")).toBeTruthy();

    // The sample is still there, unchanged.
    await user.click(screen.getByRole("button", { name: "Midland State (sample)" }));
    expect(screen.getByText("Midland State University")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Program data" })).toBeNull();
  });

  it("explains a file that isn't a program file", async () => {
    const user = userEvent.setup();
    await openYourProgram(user);
    const input = screen.getByLabelText("Import a program file");
    await user.upload(input, new File(["hello"], "notes.txt", { type: "application/json" }));
    expect(await screen.findByText(/isn't valid JSON/)).toBeTruthy();

    const save = createSave(startSession(MIDLAND_STATE, SCENARIOS, STANDARD_ARC), "Seminar", new Date());
    await user.upload(input, new File([JSON.stringify(save)], "seminar.json", { type: "application/json" }));
    expect(await screen.findByText("That's a game save, not a program file. Open it from Play on the start screen.")).toBeTruthy();

    const bad = { format: "wpa-desk-program", version: 1, program: { ...MIDLAND_STATE, budgetPerTerm: -5 }, assumptions: {} };
    await user.upload(input, new File([JSON.stringify(bad)], "bad.json", { type: "application/json" }));
    expect(await screen.findByText("Budget per term: must be a number, 0 or more (program.budgetPerTerm).")).toBeTruthy();
  });

  it("can be removed from this browser", async () => {
    const user = userEvent.setup();
    await openYourProgram(user);
    await user.click(screen.getByRole("button", { name: "Start from a copy of the sample" }));
    expect(localStorage.getItem("wpa-desk:program")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove from this browser" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(localStorage.getItem("wpa-desk:program")).toBeNull();
    expect(screen.getByText("Removed your program from this browser.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start blank" })).toBeTruthy();
  });

  it("leaves the game alone", async () => {
    const user = userEvent.setup();
    await openYourProgram(user);
    await user.click(screen.getByRole("button", { name: "Start blank" }));
    await enterSmallProgram(user);
    await user.click(screen.getByRole("button", { name: "Home" }));
    await user.click(screen.getByRole("button", { name: "New game" }));
    expect(screen.getByText("Fall, Year 1")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("wpa-desk:autosave")!).summary.institution).toBe("Midland State University");
    expect(JSON.parse(localStorage.getItem("wpa-desk:program")!).program.institution).toBe("Lakeview College");
  });
});
