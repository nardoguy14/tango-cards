// Choices that stick between visits on this device (localStorage). Saved whenever they change.
import { reactive, watch } from "vue";
import type { Dir, Filter } from "./types";

export const LEARN_SIZES = [3, 5, 7, 10, 15, 20];
export const MIX_COUNTS = [10, 20, 30, 50, 0]; // 0 = every matching card
export const FILTERS: Filter[] = ["all", "word", "grammar"];
const KEY = "tango-prefs";

export const prefs = reactive({
  dir: "jp-en" as Dir,
  showReading: true,
  learnSize: 7,
  /** Practice inside a set: all cards, only words, or only grammar. */
  kindFilter: "all" as Filter,
  /** Practice across sets. */
  mixKind: "all" as Filter,
  mixCount: 20,
  mixOff: [] as string[], // sets left out
});

try {
  const p = JSON.parse(localStorage.getItem(KEY) || "{}");
  if (["jp-en", "en-jp", "mix"].includes(p.dir)) prefs.dir = p.dir;
  if (p.showReading === false) prefs.showReading = false;
  if (LEARN_SIZES.includes(p.learnSize)) prefs.learnSize = p.learnSize;
  if (FILTERS.includes(p.kindFilter)) prefs.kindFilter = p.kindFilter;
  if (FILTERS.includes(p.mixKind)) prefs.mixKind = p.mixKind;
  if (MIX_COUNTS.includes(p.mixCount)) prefs.mixCount = p.mixCount;
  if (Array.isArray(p.mixOff)) prefs.mixOff = p.mixOff.filter((x: unknown) => typeof x === "string");
} catch { /* private mode or bad JSON: keep the defaults */ }

watch(prefs, () => {
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
}, { deep: true });
