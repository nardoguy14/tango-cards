// Study rounds.
//
// Review all: one pass through every card. Stopping partway saves the order and position;
// finishing clears it, so the next round starts from the beginning. A missed card comes back a
// few cards later.
//
// Smart learn: New -> Learning (a small rotation) -> Cleared. A card you get right leaves the
// rotation and a new one takes its place; a miss goes to the back of the rotation. Resumes where
// you stopped; clearing every card resets it.
import { reactive } from "vue";
import { FILTER_LABEL, ofKind, shuffle } from "./lib/cards";
import { filterFor, getProgress, progressKey, putProgress, type ReviewProgress, type SmartProgress } from "./lib/progress";
import { prefs } from "./prefs";
import { app, currentSet, go } from "./store";
import type { Card, CardSet, StudyCard } from "./types";

interface Common { setId: string; flipped: boolean; deals: number; total: number; queue: StudyCard[] }
export interface ReviewRound extends Common { mode: "review"; key: string | null; done: string[]; known: number; missed: Map<string, StudyCard> }
export interface SmartRound extends Common { mode: "smart"; key: string; size: number; cleared: string[]; unseen: Card[] }
export type Round = ReviewRound | SmartRound;

export const study = reactive({ round: null as Round | null });

const pickSide = () => (prefs.dir === "mix" ? (Math.random() < 0.5 ? "jp-en" : "en-jp") : prefs.dir);
const dealCard = (c: Card): StudyCard => ({ ...c, side: pickSide() });

function begin(round: Round) {
  study.round = round;
  go("study", round.setId, app.view === "study"); // a new round from the end screen replaces the old one
}

/** Review all of a set (resumable), or, with `cards`, a quick extra pass that isn't saved. */
export function startReview(set: CardSet, cards?: Card[]) {
  if (cards) {
    const queue = shuffle(cards).map(dealCard);
    return begin({ mode: "review", setId: set.id, key: null, queue, done: [], known: 0, missed: new Map(), total: queue.length, flipped: false, deals: 0 });
  }
  const key = progressKey("review", filterFor(set));
  const pool = ofKind(set.cards, filterFor(set));
  const byId = new Map(pool.map(c => [c.id, c]));
  const saved = getProgress<ReviewProgress>(set, key);
  let queueIds: string[] = [], done: string[] = [], known = 0, missedIds: string[] = [];
  if (saved?.queue?.length) {
    queueIds = saved.queue.filter(id => byId.has(id));
    done = (saved.done || []).filter(id => byId.has(id));
    known = Math.min(saved.known || 0, done.length);
    missedIds = (saved.missed || []).filter(id => byId.has(id));
  }
  const placed = new Set([...queueIds, ...done]);
  const fresh = shuffle(pool.filter(c => !placed.has(c.id))).map(c => c.id); // first run, or cards added since
  const queue = [...queueIds, ...fresh].map(id => dealCard(byId.get(id)!));
  begin({
    mode: "review", setId: set.id, key, queue, done, known, flipped: false, deals: 0,
    total: done.length + queue.length,
    missed: new Map(missedIds.map(id => [id, dealCard(byId.get(id)!)])),
  });
}

export function startSmart(set: CardSet) {
  const key = progressKey("smart", filterFor(set));
  const pool = ofKind(set.cards, filterFor(set));
  const byId = new Map(pool.map(c => [c.id, c]));
  const saved = getProgress<SmartProgress>(set, key) || { cleared: [], learning: [] };
  const cleared = (saved.cleared || []).filter(id => byId.has(id));
  const placed = new Set(cleared);
  const learning = (saved.learning || []).filter(id => byId.has(id) && !placed.has(id));
  learning.forEach(id => placed.add(id));
  const round: SmartRound = {
    mode: "smart", setId: set.id, key, flipped: false, deals: 0, size: prefs.learnSize, cleared, total: pool.length,
    queue: learning.map(id => dealCard(byId.get(id)!)),
    unseen: shuffle(pool.filter(c => !placed.has(c.id))),
  };
  topUp(round);
  begin(round);
}

/** Random cards from the sets picked under "Practice across sets". */
export function mixPool() {
  return app.sets
    .filter(s => !prefs.mixOff.includes(s.id))
    .flatMap(s => ofKind(s.cards, prefs.mixKind).map(c => ({ ...c, from: s.name })));
}

export function startMix() {
  const pool = shuffle(mixPool());
  const cards = prefs.mixCount ? pool.slice(0, prefs.mixCount) : pool;
  if (!cards.length) return;
  const name = prefs.mixKind === "all" ? "Mixed practice" : `Mixed ${FILTER_LABEL[prefs.mixKind].toLowerCase()}`;
  practice({ id: "mix", virtual: true, name, cards, progress: {} });
}

/** Practice exactly these cards (from the finder, or a mix) as a one-off round. */
export function practice(set: CardSet) {
  app.mixSet = set;
  startReview(set, set.cards);
}

function topUp(r: SmartRound) { // keep the rotation at its size while new cards remain
  while (r.queue.length < r.size && r.unseen.length) r.queue.push(dealCard(r.unseen.shift()!));
}

export function flip() {
  const r = study.round;
  if (r?.queue[0]) r.flipped = !r.flipped;
}

/** Answer the card on top: right (`ok`) or "again". */
export function grade(ok: boolean) {
  const r = study.round, set = currentSet.value;
  if (!r) return;
  const card = r.queue.shift();
  if (!card) return;
  r.deals++;
  r.flipped = false;
  if (r.mode === "smart") {
    if (ok) { r.cleared.push(card.id); topUp(r); }
    else { card.side = pickSide(); r.queue.push(card); } // back of the rotation: everything else comes first
    if (set) putProgress(set, r.key, r.queue.length || r.unseen.length ? { cleared: r.cleared, learning: r.queue.map(c => c.id) } : null);
    return;
  }
  if (ok) {
    if (!r.missed.has(card.id)) r.known++;
    r.done.push(card.id);
  } else {
    r.missed.set(card.id, card);
    r.queue.splice(Math.min(r.queue.length, 3), 0, card); // comes back a few cards later
  }
  if (r.key && set) {
    putProgress(set, r.key, r.queue.length
      ? { queue: r.queue.map(c => c.id), done: r.done, known: r.known, missed: [...r.missed.keys()] }
      : null); // finished: next time starts from the beginning
  }
}
