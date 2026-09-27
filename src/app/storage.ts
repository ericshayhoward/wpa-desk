/**
 * Browser storage for saves. Every access is guarded: storage can be
 * unavailable (private windows, blocked site data) or full, and the app must
 * keep working without it.
 */
import { ARCS, SCENARIOS } from "../content";
import { createSave, parseSave, type SaveFile, type TrainingSession } from "../training";

const PREFIX = "wpa-desk:";
export const AUTOSAVE = "autosave";
export const SLOTS = ["slot-1", "slot-2", "slot-3"] as const;
export type SlotId = typeof AUTOSAVE | (typeof SLOTS)[number];

export type ReadResult = { ok: true; save: SaveFile } | { ok: false; error: string } | { ok: false; empty: true };

export function readSlot(slot: SlotId): ReadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(PREFIX + slot);
  } catch {
    return { ok: false, error: "This browser isn't allowing saved data." };
  }
  if (raw === null) return { ok: false, empty: true };
  try {
    return { ok: true, save: parseSave(JSON.parse(raw), SCENARIOS, ARCS) };
  } catch (err) {
    return { ok: false, error: err instanceof SyntaxError ? "The saved data is damaged." : (err as Error).message };
  }
}

/** Returns an error message, or null on success. */
export function writeSlot(slot: SlotId, session: TrainingSession, label: string): string | null {
  try {
    localStorage.setItem(PREFIX + slot, JSON.stringify(createSave(session, label, new Date())));
    return null;
  } catch {
    return "Couldn't save: this browser's storage is unavailable or full. Try exporting to a file instead.";
  }
}

export function deleteSlot(slot: SlotId): void {
  try {
    localStorage.removeItem(PREFIX + slot);
  } catch {
    // Nothing to do; the slot is unreachable either way.
  }
}

/** Serializes a session for download as a file. */
export function exportFile(session: TrainingSession, label: string): { name: string; text: string } {
  const save = createSave(session, label, new Date());
  const date = save.savedAt.slice(0, 10);
  const term = save.summary.term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { name: `wpa-desk-${term}-${date}.json`, text: JSON.stringify(save, null, 2) };
}

/** Parses an imported file's text. Throws with a player-readable message. */
export function importFile(text: string): SaveFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a WPA Desk save (it isn't valid JSON).");
  }
  return parseSave(raw, SCENARIOS, ARCS);
}

export type Theme = "light" | "dark";

/** The viewer's chosen color theme, or null to follow the system setting. */
export function readTheme(): Theme | null {
  try {
    const t = localStorage.getItem(PREFIX + "theme");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(PREFIX + "theme", theme);
  } catch {
    // The choice just won't persist past this page load.
  }
}
