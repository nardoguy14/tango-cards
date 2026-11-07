// "Find cards": a short conversation with a language model about which cards to study.
// Each answer replaces the results; follow-ups ("only the verbs") build on the last answer.
import { reactive } from "vue";
import { api } from "./api";
import { ofKind } from "./lib/cards";
import { practice } from "./study";
import type { Filter, FoundCard, Turn } from "./types";

export const finder = reactive({
  turns: [] as Turn[],
  results: [] as FoundCard[],
  kind: "all" as Filter,
  off: [] as string[], // results left out of practice
  busy: false,
  error: "",
  draft: "",
});

export const kept = () => ofKind(finder.results, finder.kind).filter(c => !finder.off.includes(c.id));

export async function ask(text: string) {
  finder.turns.push({ role: "user", text, ids: [] });
  finder.draft = ""; finder.busy = true; finder.error = "";
  try {
    const out = await api.find(finder.turns);
    finder.turns.push({ role: "assistant", text: out.reply, ids: out.cards.map(c => c.id) });
    finder.results = out.cards; finder.off = []; finder.kind = "all";
  } catch (e) {
    finder.turns.pop(); finder.draft = text; // nothing came back: let them resend it
    finder.error = (e as Error).message || "The finder didn't answer.";
  }
  finder.busy = false;
}

export function toggle(id: string) {
  const i = finder.off.indexOf(id);
  i >= 0 ? finder.off.splice(i, 1) : finder.off.push(id);
}

export function clear() {
  Object.assign(finder, { turns: [], results: [], kind: "all", off: [], busy: false, error: "", draft: "" });
}

export function practiceFound() {
  const cards = kept().map(c => ({ ...c, from: c.set_name }));
  if (!cards.length) return;
  const ask = [...finder.turns].reverse().find(t => t.role === "user")?.text || "Found cards";
  practice({ id: "mix", virtual: true, found: true, name: ask.length > 28 ? ask.slice(0, 27) + "…" : ask, cards, progress: {} });
}
