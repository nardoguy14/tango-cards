<!-- The end of a round: the score, and what to do next. -->
<script setup lang="ts">
import { computed } from "vue";
import { startMix, startReview, startSmart, type Round } from "../../study";
import type { CardSet } from "../../types";

const props = defineProps<{ round: Round; set: CardSet }>();
const missed = computed(() => (props.round.mode === "review" ? [...props.round.missed.values()] : []));

function again() {
  if (props.set.found) startReview(props.set, props.set.cards);
  else if (props.set.virtual) startMix();
  else startReview(props.set);
}
</script>

<template>
  <div v-if="round.mode === 'smart'" class="done panel">
    <div class="eyebrow">Set cleared</div>
    <div class="score">{{ round.cleared.length }} / {{ round.total }}</div>
    <p class="muted">Every card in {{ set.name }} is cleared.</p>
    <div class="row" style="justify-content:center;margin-top:16px">
      <!-- progress reset itself when the last card cleared -->
      <button class="btn primary" @click="startSmart(set)">Start over</button>
      <button class="btn" @click="startReview(set)">Review all</button>
    </div>
  </div>
  <div v-else class="done panel">
    <div class="eyebrow">Round finished</div>
    <div class="score">{{ round.known }} / {{ round.total }}</div>
    <p class="muted">known on the first try{{ missed.length ? ` · ${missed.length} to review` : ". Perfect round." }}</p>
    <div class="row" style="justify-content:center;margin-top:16px">
      <button v-if="missed.length" class="btn primary" @click="startReview(set, missed)">Review {{ missed.length }} missed</button>
      <button class="btn" :class="{ primary: !missed.length }" @click="again">{{ set.found ? "Again" : set.virtual ? "New mix" : "Study all again" }}</button>
    </div>
  </div>
</template>
