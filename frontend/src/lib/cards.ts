// Small helpers about cards that every screen uses.
import type { Card, Dir, Filter, Kind } from "../types";

export const kindOf = (c: Card): Kind => (c.kind === "grammar" ? "grammar" : "word");
export const ofKind = <T extends Card>(cards: T[], k: Filter): T[] =>
  k === "all" ? cards : cards.filter(c => kindOf(c) === k);

export const FILTER_LABEL: Record<Filter, string> = { all: "All", word: "Words", grammar: "Grammar" };
export const DIR_LABEL: Record<Dir, string> = { "jp-en": "日本語 → EN", "en-jp": "EN → 日本語", mix: "Mixed" };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "1 card", "3 cards" */
export const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
