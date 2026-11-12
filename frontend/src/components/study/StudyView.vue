<!-- Studying: the card, how far along you are, and the answer buttons. One fixed screen. -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { DIR_LABEL } from "../../lib/cards";
import { speakCard, speech, stopSpeaking } from "../../lib/speech";
import { prefs } from "../../prefs";
import { back } from "../../store";
import { flip, grade, type Round } from "../../study";
import type { CardSet } from "../../types";
import Flashcard from "./Flashcard.vue";
import RoundDone from "./RoundDone.vue";

const props = defineProps<{ round: Round; set: CardSet }>();
const card = computed(() => props.round.queue[0]);
const done = computed(() => props.round.total - props.round.queue.length);
const pct = (n: number) => `${props.round.total ? (n / props.round.total) * 100 : 0}%`;
const flashcard = ref<InstanceType<typeof Flashcard>>();

// Read aloud: say the Japanese as soon as it's showing: on a new card when it's asked
// Japanese-first, or when the card is flipped to its back (which always shows the Japanese).
watch(() => [props.round.deals, props.round.flipped] as const, ([, flipped]) => {
  const c = card.value;
  const jpFirst = !!c?.table || c?.side === "jp-en"; // a table card's front always shows the Japanese
  if (prefs.readAloud && c && (jpFirst ? !flipped : flipped)) speakCard(c);
}, { immediate: true });

// The round stays until another starts; clearing it now would blank this screen mid-transition.
const leave = () => (props.set.virtual ? back("library", null) : back("set"));

// keys: space flips, arrows answer. While studying, the page itself doesn't scroll.
function onKey(e: KeyboardEvent) {
  if ((e.target as HTMLElement).matches?.("input:not([type=checkbox]), select, textarea")) return; // typing, not a tickbox
  if (e.key === " ") { e.preventDefault(); flip(); }
  else if (e.key === "ArrowRight") flashcard.value?.throwCard(true);
  else if (e.key === "ArrowLeft") flashcard.value?.throwCard(false);
}
const noScroll = (e: TouchEvent) => e.preventDefault();
onMounted(() => { addEventListener("keydown", onKey); addEventListener("touchmove", noScroll, { passive: false }); });
onUnmounted(() => { removeEventListener("keydown", onKey); removeEventListener("touchmove", noScroll); stopSpeaking(); });
</script>

<template>
  <div class="screen stack">
    <div class="row">
      <button class="btn ghost" @click="leave">← {{ set.virtual ? "All sets" : set.name }}</button>
      <span class="spacer"></span>
      <span v-if="set.virtual" class="learnnote">{{ set.name }} ·</span>
      <span class="learnnote">{{ DIR_LABEL[prefs.dir] }}</span>
    </div>
    <div class="row">
      <span v-if="round.mode === 'smart'" class="piles" aria-label="Card piles">
        <span><i class="dot new"></i>New <b>{{ round.unseen.length }}</b></span>
        <span><i class="dot learning"></i>Learning <b>{{ round.queue.length }}</b></span>
        <span><i class="dot cleared"></i>Cleared <b>{{ round.cleared.length }}</b></span>
      </span>
      <span v-else class="mono muted">{{ done }} / {{ round.total }}</span>
      <span class="spacer"></span>
      <label class="note row" style="gap:6px"><input v-model="prefs.showReading" type="checkbox" style="padding:0"> Reading on front</label>
      <label v-if="speech.supported" class="note row" style="gap:6px"><input v-model="prefs.readAloud" type="checkbox" style="padding:0"> Read aloud</label>
    </div>
    <div v-if="round.mode === 'smart'" class="progress split">
      <i :style="{ width: pct(round.cleared.length) }"></i><i class="learning" :style="{ width: pct(round.queue.length) }"></i>
    </div>
    <div v-else class="progress"><i :style="{ width: pct(done) }"></i></div>

    <template v-if="card">
      <Flashcard ref="flashcard" :key="round.deals" :card="card" :flipped="round.flipped" @flip="flip" @answer="grade" />
      <div class="grade" :style="{ visibility: round.flipped ? 'visible' : 'hidden' }">
        <button class="btn again" @click="flashcard?.throwCard(false)">Again</button>
        <button class="btn good" @click="flashcard?.throwCard(true)">Got it</button>
      </div>
      <div class="keys">Swipe → got it · ← again · tap to flip<br><kbd>Space</kbd> flip · <kbd>←</kbd> again · <kbd>→</kbd> got it</div>
    </template>
    <RoundDone v-else :round="round" :set="set" />
  </div>
</template>
