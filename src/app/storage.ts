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

/** Erases the autosave, every slot, and the export reminder's mark, for a shared computer. The theme stays. */
export function clearBrowserSaves(): void {
  for (const slot of [AUTOSAVE, ...SLOTS] satisfies SlotId[]) deleteSlot(slot);
  writeBackup(null);
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

/** Downloads the session as a save file and returns the file's name. */
export function downloadSession(session: TrainingSession, label: string): string {
  const { name, text } = exportFile(session, label);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  return name;
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

/**
 * Where the session stood when the player last kept a copy outside this
 * browser (an export or an import), or chose "Not now" on the reminder.
 */
export interface BackupMark {
  at: string;
  term: number;
  decisions: number;
  /** "Not now" rather than a file: remind again next term, not after a week. */
  snoozed?: boolean;
}

const BACKUP = PREFIX + "backup";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function backupMark(session: TrainingSession, now: Date, snoozed = false): BackupMark {
  return { at: now.toISOString(), term: session.termIndex, decisions: session.decisions.length, ...(snoozed && { snoozed }) };
}

export function readBackup(): BackupMark | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(BACKUP) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const m = raw as Partial<BackupMark>;
    if (typeof m.at !== "string" || typeof m.term !== "number" || typeof m.decisions !== "number") return null;
    return { at: m.at, term: m.term, decisions: m.decisions, ...(m.snoozed === true && { snoozed: true }) };
  } catch {
    return null;
  }
}

export function writeBackup(mark: BackupMark | null): void {
  try {
    if (mark) localStorage.setItem(BACKUP, JSON.stringify(mark));
    else localStorage.removeItem(BACKUP);
  } catch {
    // The reminder just comes back sooner.
  }
}

/**
 * Whether to remind the player to export: they've made decisions that exist
 * only in this browser, and either a term has passed since their last copy or
 * a week has (browsers such as Safari clear site data after about a week away).
 */
export function needsBackup(session: TrainingSession, mark: BackupMark | null, now: Date): boolean {
  if (session.decisions.length === 0 || session.ending) return false;
  if (!mark) return true;
  if (session.termIndex <= mark.term && session.decisions.length <= mark.decisions) return false;
  if (session.termIndex > mark.term) return true;
  return !mark.snoozed && now.getTime() - Date.parse(mark.at) >= WEEK_MS;
}

let persistenceRequested = false;

/**
 * Asks the browser to keep this site's data instead of clearing it when space
 * runs low. Browsers decide on their own; Firefox may ask the player, so this
 * runs once, after their first decision rather than on page load.
 */
export function requestPersistence(): void {
  if (persistenceRequested) return;
  persistenceRequested = true;
  try {
    const storage = navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    storage
      .persisted()
      .then((kept) => (kept ? undefined : storage.persist()))
      .catch(() => {});
  } catch {
    // Not available here; the export reminder still covers it.
  }
}
