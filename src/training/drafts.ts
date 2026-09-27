/**
 * Drafting and revision history for memos and reflections.
 *
 * History is recorded as snapshots, not keystrokes: saved drafts, pauses in
 * writing, large insertions, quoted evidence, the sent version, and later
 * portfolio revisions. Writers are told it's kept and included in exports.
 * Timestamps are passed in so these functions stay pure.
 */
import type { MemoDraft, TrainingSession } from "./types";

export type DraftReason = "pause" | "draft" | "large-change" | "quoted-evidence" | "sent" | "revision";

export const DRAFT_REASON_LABELS: Record<DraftReason, string> = {
  pause: "Autosaved while writing",
  draft: "Saved draft",
  "large-change": "Large insertion",
  "quoted-evidence": "Quoted evidence",
  sent: "Sent",
  revision: "Portfolio revision",
};

/** How long a pause in typing triggers a snapshot, and how big an insertion counts as large. */
export const SNAPSHOT_RULES = { pauseMs: 20_000, largeChangeWords: 25 } as const;

export const HISTORY_NOTICE =
  "Your drafting history (saved drafts and automatic snapshots as you write) is kept and included in exported case files.";

export interface DraftVersion {
  at: string;
  reason: DraftReason;
  subject: string;
  ask: string;
  body: string;
  words: number;
  /** The writer's revision note, for saved drafts and portfolio revisions. */
  note?: string;
}

/** An unsent memo, kept with the session so it survives reloads. */
export interface DraftInProgress {
  optionId: string;
  startedAt: string;
  draft: MemoDraft;
  history: DraftVersion[];
}

export interface ReflectionVersion {
  at: string;
  text: string;
  words: number;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

type Content = Pick<MemoDraft, "subject" | "ask" | "body">;

const sameContent = (a: Content, b: Content) => a.subject === b.subject && a.ask === b.ask && a.body === b.body;

/**
 * Appends a snapshot if the content changed since the last one. Saved drafts
 * with a note, and the sent version, are always recorded.
 */
export function snapshot(history: DraftVersion[], content: Content, reason: DraftReason, at: Date, note?: string): DraftVersion[] {
  const last = history[history.length - 1];
  const trimmedNote = note?.trim() || undefined;
  if (last && sameContent(last, content) && reason !== "sent" && !trimmedNote) return history;
  return [
    ...history,
    {
      at: at.toISOString(),
      reason,
      subject: content.subject,
      ask: content.ask,
      body: content.body,
      words: wordCount(content.body),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    },
  ];
}

/** Stores (or clears, with null) the in-progress memo for a scenario. */
export function setDraftInProgress(session: TrainingSession, scenarioId: string, draft: DraftInProgress | null): TrainingSession {
  const drafts = { ...(session.drafts ?? {}) };
  if (draft) drafts[scenarioId] = draft;
  else delete drafts[scenarioId];
  return { ...session, drafts };
}

/** Revises a sent memo for the portfolio. The sent version stays in history untouched. */
export function reviseMemo(session: TrainingSession, memoId: string, content: Content, note: string, at: Date): TrainingSession {
  const memo = session.dossier.find((m) => m.id === memoId);
  if (!memo) throw new Error(`Unknown memo ${memoId}`);
  const history = snapshot(memo.history ?? [], content, "revision", at, note);
  if (history === memo.history) return session;
  return { ...session, dossier: session.dossier.map((m) => (m.id === memoId ? { ...m, history } : m)) };
}

/** The latest portfolio revision of a memo, if it has been revised since sending. */
export function latestRevision(history: DraftVersion[] | undefined): DraftVersion | null {
  const h = history ?? [];
  const sentAt = h.findIndex((v) => v.reason === "sent");
  const last = h[h.length - 1];
  return sentAt >= 0 && last && last.reason === "revision" && h.indexOf(last) > sentAt ? last : null;
}

/** Minutes from opening the composer to sending, if both are known. */
export function draftingMinutes(startedAt: string | undefined, history: DraftVersion[] | undefined): number | null {
  const sent = history?.find((v) => v.reason === "sent");
  if (!startedAt || !sent) return null;
  const ms = Date.parse(sent.at) - Date.parse(startedAt);
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 60_000) : null;
}

// ---------------------------------------------------------------------------
// Word-level comparison
// ---------------------------------------------------------------------------

export type DiffPart = { type: "same" | "added" | "removed"; text: string };

/**
 * Word-level diff (longest common subsequence), with whitespace kept so the
 * result reads naturally. Very long texts fall back to "all replaced".
 */
export function wordDiff(before: string, after: string): DiffPart[] {
  // Words, whitespace, and punctuation are separate tokens, so a comma
  // change reads as a comma change rather than a whole new word.
  const tokens = (t: string) => t.split(/(\s+|[^\p{L}\p{N}\s'’-])/u).filter((x) => x !== "");
  const a = tokens(before);
  const b = tokens(after);
  if (a.length * b.length > 4_000_000) {
    return merge([
      ...(before ? [{ type: "removed" as const, text: before }] : []),
      ...(after ? [{ type: "added" as const, text: after }] : []),
    ]);
  }
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      parts.push({ type: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      parts.push({ type: "removed", text: a[i++]! });
    } else {
      parts.push({ type: "added", text: b[j++]! });
    }
  }
  while (i < a.length) parts.push({ type: "removed", text: a[i++]! });
  while (j < b.length) parts.push({ type: "added", text: b[j++]! });
  return merge(parts);
}

function merge(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    // Whitespace between two changes of the same kind joins them.
    if (last && last.type === p.type) last.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Renders a diff for Markdown: ~~removed~~ and **added**. */
export function diffToMarkdown(parts: DiffPart[]): string {
  return parts
    .map((p, i) => {
      if (p.type === "same" || !p.text.trim()) return p.text;
      const lead = p.text.match(/^\s*/)![0];
      const trail = p.text.match(/\s*$/)![0];
      const core = p.text.trim();
      // A word replaced by a word reads better with a space between them.
      const prev = parts[i - 1];
      const gap = p.type === "added" && prev?.type === "removed" && !lead && /\w$/.test(prev.text) && /^\w/.test(core) ? " " : "";
      return p.type === "added" ? `${gap}${lead}**${core}**${trail}` : `${lead}~~${core}~~${trail}`;
    })
    .join("");
}
