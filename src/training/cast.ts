import { STAKEHOLDER_IDS, type StakeholderId } from "../model";
import { DEFAULT_PERSUASION, type Character, type PersuasionProfile } from "./types";

/** Validates an untyped cast (usually parsed YAML). Errors name the exact field. */
export function parseCast(raw: unknown): Character[] {
  if (!Array.isArray(raw)) throw new Error("cast: expected a list of characters");
  const cast = raw.map((c, i) => parseCharacter(c, `cast entry ${i + 1}`));
  const ids = new Set(cast.map((c) => c.stakeholder));
  if (ids.size !== cast.length) throw new Error("cast: each stakeholder can have only one character");
  return cast;
}

function parseCharacter(raw: unknown, at: string): Character {
  if (typeof raw !== "object" || raw === null) throw new Error(`${at}: expected an object`);
  const r = raw as Record<string, unknown>;
  const text = (k: string) => {
    if (typeof r[k] !== "string" || !(r[k] as string).trim()) throw new Error(`${at}: "${k}" must be non-empty text`);
    return (r[k] as string).trim();
  };
  if (!(STAKEHOLDER_IDS as readonly unknown[]).includes(r.stakeholder)) {
    throw new Error(`${at}: "${String(r.stakeholder)}" is not a stakeholder`);
  }
  const p = (r.persuasion ?? {}) as Record<string, unknown>;
  const threshold = (k: keyof PersuasionProfile) => {
    const v = p[k] ?? DEFAULT_PERSUASION[k];
    if (typeof v !== "number" || v < 0 || v > 100) throw new Error(`${at}: persuasion.${k} must be 0–100`);
    return v;
  };
  const persuasion = { withEvidence: threshold("withEvidence"), withoutEvidence: threshold("withoutEvidence") };
  if (persuasion.withoutEvidence < persuasion.withEvidence) {
    throw new Error(`${at}: persuasion.withoutEvidence can't be lower than withEvidence`);
  }
  if (r.portrait !== undefined && (typeof r.portrait !== "string" || !r.portrait.trim())) {
    throw new Error(`${at}: "portrait" must be non-empty text`);
  }
  return {
    stakeholder: r.stakeholder as StakeholderId,
    name: text("name"),
    shortName: text("shortName"),
    title: text("title"),
    bio: text("bio"),
    responds: text("responds"),
    persuasion,
    ...(typeof r.portrait === "string" ? { portrait: r.portrait.trim() } : {}),
  };
}

export function characterFor(cast: Character[], id: StakeholderId): Character | undefined {
  return cast.find((c) => c.stakeholder === id);
}

export function persuasionProfile(cast: Character[], id: StakeholderId): PersuasionProfile {
  return characterFor(cast, id)?.persuasion ?? DEFAULT_PERSUASION;
}
