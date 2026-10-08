// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { playGame } from "./helpers";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const campus = () => screen.getByRole("complementary", { name: "Campus" });

/** The map starts folded into a button; opens it. */
async function playWithCampus(user: ReturnType<typeof userEvent.setup>) {
  await playGame(user);
  await user.click(screen.getByRole("button", { name: /^Show the campus/ }));
}

describe("the campus map", () => {
  it("shows what's waiting where, and opens it from the building", async () => {
    const user = userEvent.setup();
    await playWithCampus(user);
    const map = within(campus());
    expect(map.getByText(/Fall morning · 60 of 60 admin hours left/)).toBeTruthy();

    // Both of Fall Y1's items come from Dr. Cherry, in Humanities Hall.
    await user.click(map.getByRole("button", { name: "Humanities Hall, 2 waiting" }));
    const card = within(map.getByRole("region", { name: "Humanities Hall" }));
    expect(card.getByText("Fwd: FYC section caps for spring")).toBeTruthy();
    expect(card.getByLabelText("Dr. Hale's trust in you")).toBeTruthy();

    await user.click(card.getByRole("button", { name: "Open “Fwd: FYC section caps for spring”" }));
    expect(screen.getByRole("heading", { name: "How do you respond?" })).toBeTruthy();
    // The card closes behind it.
    expect(map.queryByRole("region", { name: "Humanities Hall" })).toBeNull();
  });

  it("explains Founders Hall's windows with this term's sections", async () => {
    const user = userEvent.setup();
    await playWithCampus(user);
    const map = within(campus());
    await user.click(map.getByRole("button", { name: "Founders Hall" }));
    const card = within(map.getByRole("region", { name: "Founders Hall" }));
    expect(card.getByText(/^60 sections of first-year writing meet here this fall/)).toBeTruthy();
    expect(card.getByText("Adjunct faculty")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(map.queryByRole("region", { name: "Founders Hall" })).toBeNull();
  });

  it("selects a building from the keyboard", async () => {
    const user = userEvent.setup();
    await playWithCampus(user);
    const map = within(campus());
    map.getByRole("button", { name: "Kessler Library" }).focus();
    await user.keyboard("{Enter}");
    expect(map.getByRole("region", { name: "Kessler Library" }).textContent).toMatch(/Your dissertation: 0%/);
  });

  it("starts closed, folds into a button, and remembers that", async () => {
    const user = userEvent.setup();
    await playGame(user);
    expect(screen.queryByRole("complementary", { name: "Campus" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show the campus, 2 waiting" }));
    expect(localStorage.getItem("wpa-desk:campus")).toBe("open");
    await user.click(screen.getByRole("button", { name: "Hide the campus" }));
    expect(screen.queryByRole("complementary", { name: "Campus" })).toBeNull();
    expect(localStorage.getItem("wpa-desk:campus")).toBe("closed");

    cleanup();
    await playGame(user);
    await user.click(screen.getByRole("button", { name: "Show the campus, 2 waiting" }));
    expect(campus()).toBeTruthy();
    expect(localStorage.getItem("wpa-desk:campus")).toBe("open");
  });
});
