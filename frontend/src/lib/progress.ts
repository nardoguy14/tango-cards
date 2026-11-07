// Where you stopped studying a set. It lives on the server with the set, so it follows you
// between devices. Practice can be limited to words or grammar, and each choice keeps its own
// place ("smart", "smart:grammar", ...), so switching doesn't wipe the others.
import { api } from "../api";
import { prefs } from "../prefs";
import type { CardSet, Filter } from "../types";
import { ofKind } from "./cards";

export type Mode = "smart" | "review";

export interface ReviewProgress { queue: string[]; done: string[]; known: number; missed: string[] }
export interface SmartProgress { cleared: string[]; learning: string[] }

// Saves run one after another so a slow request can't overwrite a newer one.
let chain: Promise<unknown> = Promise.resolve();
/** Resolves once every progress save so far has finished. */
export const savesDone = () => chain;

export const mixedKinds = (set: CardSet) => {
  const g = ofKind(set.cards, "grammar").length;
  return g > 0 && g < set.cards.length;
};
/** The filter that applies to this set: the chosen one, unless the set has only one kind. */
export const filterFor = (set: CardSet): Filter => (set.virtual || !mixedKinds(set) ? "all" : prefs.kindFilter);
export const progressKey = (mode: Mode, k: Filter) => (k === "all" ? mode : `${mode}:${k}`);

export function getProgress<T>(set: CardSet, key: string): T | null {
  return (set.progress?.[key] as T) || null;
}

export function putProgress(set: CardSet, key: string, data: object | null) {
  const next = { ...(set.progress || {}) };
  if (data) next[key] = data;
  else delete next[key];
  set.progress = next;
  if (set.example || set.virtual) return; // the example set and mixed rounds aren't saved anywhere
  const setId = set.id;
  chain = chain.then(() => api.saveProgress(setId, next)).catch(() => {});
}

/** What the set screen shows under its Practice buttons. */
export function progressSummary(set: CardSet) {
  const k = filterFor(set);
  const ids = new Set(ofKind(set.cards, k).map(c => c.id));
  const smart = getProgress<SmartProgress>(set, progressKey("smart", k));
  const review = getProgress<ReviewProgress>(set, progressKey("review", k));
  return {
    smart: !!smart,
    cleared: (smart?.cleared || []).filter(id => ids.has(id)).length,
    review: !!review,
    reviewed: (review?.done || []).filter(id => ids.has(id)).length,
  };
}
