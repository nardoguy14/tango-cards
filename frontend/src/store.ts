// App state: the sets, which screen is showing, and the work in progress on each set.
//
// Screens: library (home) -> set -> add (add cards) / study. Moving between them goes through
// go()/back(), which cross-fade with a View Transition where the browser has one and keep the
// browser history in step, so the phone's back button works too.
import { computed, nextTick, reactive } from "vue";
import { api } from "./api";
import { savesDone } from "./lib/progress";
import type { Card, CardSet, Photo } from "./types";

export type View = "library" | "set" | "add" | "study";

const EXAMPLE: CardSet = {
  id: "example", example: true, name: "Example: Vocab 1", progress: {},
  cards: [
    { id: "e1", jp: "水", reading: "みず", en: "water" },
    { id: "e2", jp: "食べる", reading: "たべる", en: "to eat" },
    { id: "e3", jp: "学校", reading: "がっこう", en: "school" },
    { id: "e4", jp: "ありがとう", reading: "", en: "thank you" },
    { id: "e5", jp: "電車", reading: "でんしゃ", en: "train" },
    { id: "e6", jp: "猫", reading: "ねこ", en: "cat" },
  ],
};

/** Work in progress on one set's add-cards screen. Kept while you move around the app. */
export interface SetDraft {
  staged: File[];            // new photos waiting for "Make cards"
  picked: string[];          // saved photos to read again
  photos: Photo[] | null;    // the set's photos, once loaded
  pending: Card[] | null;    // cards the model found, waiting for review
  instructions: string;
}

export const app = reactive({
  sets: [] as CardSet[],
  example: structuredClone(EXAMPLE),
  view: "library" as View,
  setId: null as string | null,
  /** A practice round across sets ("mix"), shown as if it were a set. */
  mixSet: null as CardSet | null,
  loaded: false,
  error: "",
  model: "",
  helper: "",
  helperUp: false,
  drafts: {} as Record<string, SetDraft>,
});

export const visibleSets = computed(() => (app.sets.length ? app.sets : [app.example]));
export const currentSet = computed<CardSet | undefined>(() =>
  app.setId === "mix" ? app.mixSet ?? undefined : visibleSets.value.find(s => s.id === app.setId));

export function draftFor(setId: string): SetDraft {
  return (app.drafts[setId] ??= { staged: [], picked: [], photos: null, pending: null, instructions: "" });
}

// ---------- moving between screens ----------
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
let depth = 0;

function show(view: View, setId: string | null) {
  const apply = async () => { app.view = view; app.setId = setId; await nextTick(); };
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(apply);
  else apply();
}

/** Open a screen, as a new step in the history. `replace` swaps the current step instead. */
export function go(view: View, setId: string | null = app.setId, replace = false) {
  if (!replace) depth++;
  const entry = { view, setId, depth };
  replace ? history.replaceState(entry, "") : history.pushState(entry, "");
  show(view, setId);
}

/** Leave this screen the way the phone's back button would, or go to `fallback` if there's no step to return to. */
export function back(fallback: View, setId: string | null = app.setId) {
  if (depth > 0) history.back();
  else go(fallback, setId, true);
}

addEventListener("popstate", e => {
  const s = e.state as { view?: View; setId?: string | null; depth?: number } | null;
  depth = s?.depth ?? 0;
  show(s?.view ?? "library", s?.setId ?? null);
});
history.replaceState({ view: "library", setId: null, depth: 0 }, "");

// ---------- loading and saving ----------
export async function refreshHealth() {
  try {
    const h = await api.health();
    app.model = h.model; app.helper = h.helper; app.helperUp = h.helper_up;
  } catch { /* the server will say more when a real call fails */ }
}

export async function loadSets() {
  try { app.sets = await api.listSets(); }
  catch (e) { app.error = "Couldn't load your sets: " + (e as Error).message; }
  app.loaded = true;
}

export async function boot() {
  await refreshHealth();
  await loadSets();
  // The local model can still be loading when the page opens: check again until it's up.
  const wait = setInterval(async () => {
    if (app.helperUp) return clearInterval(wait);
    await refreshHealth();
  }, 15000);
}

/** Reload sets once pending progress saves land, so the home screen shows fresh counts. */
export const reloadAfterSaves = () => savesDone().then(loadSets);

/** Save a set's name and cards. Editing the example turns it into a real set. */
export async function persist(set: CardSet) {
  try {
    if (set.example) {
      const saved = await api.createSet(set.name.replace(/^Example:\s*/, ""), set.cards);
      app.sets.push(saved);
      app.example = structuredClone(EXAMPLE);
      if (app.drafts.example) { app.drafts[saved.id] = app.drafts.example; delete app.drafts.example; }
      go(app.view, saved.id, true);
      return saved;
    }
    await api.saveSet(set);
    return set;
  } catch (e) {
    app.error = "Couldn't save: " + ((e as Error).message || "the server didn't respond");
  }
}

export async function createSet(name: string) {
  try {
    const set = await api.createSet(name);
    app.sets.push(set);
    go("set", set.id);
  } catch (e) { app.error = "Couldn't create the set: " + (e as Error).message; }
}

export async function deleteSet(set: CardSet) {
  if (!set.example) {
    try { await api.deleteSet(set.id); }
    catch (e) { app.error = "Couldn't delete: " + (e as Error).message; return; }
    app.sets = app.sets.filter(s => s.id !== set.id);
    delete app.drafts[set.id];
  }
  go("library", null, true);
}
