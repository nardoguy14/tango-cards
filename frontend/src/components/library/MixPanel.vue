<!-- Practice across sets: random cards from the sets you pick, words, grammar or both. -->
<script setup lang="ts">
import { computed } from "vue";
import { count, DIR_LABEL, FILTER_LABEL, ofKind } from "../../lib/cards";
import { FILTERS, MIX_COUNTS, prefs } from "../../prefs";
import { app } from "../../store";
import { mixPool, startMix } from "../../study";
import type { Dir } from "../../types";
import OptionsBox from "../ui/OptionsBox.vue";
import Segmented from "../ui/Segmented.vue";

const chosen = computed(() => app.sets.filter(s => !prefs.mixOff.includes(s.id)));
const ready = computed(() => {
  const n = mixPool().length;
  return prefs.mixCount ? Math.min(prefs.mixCount, n) : n;
});
const kindOptions = computed(() => FILTERS.map(k => ({
  value: k, label: FILTER_LABEL[k], count: chosen.value.reduce((t, s) => t + ofKind(s.cards, k).length, 0),
})));
const dirOptions = (Object.keys(DIR_LABEL) as Dir[]).map(d => ({ value: d, label: DIR_LABEL[d] }));
const summary = computed(() => {
  const from = chosen.value.length === app.sets.length ? "all sets"
    : chosen.value.length ? chosen.value.map(s => s.name).join(", ") : "no sets";
  return `${FILTER_LABEL[prefs.mixKind]} · ${from} · ${prefs.mixCount || "all"} · ${DIR_LABEL[prefs.dir]}`;
});

function toggleSet(id: string) {
  const i = prefs.mixOff.indexOf(id);
  i >= 0 ? prefs.mixOff.splice(i, 1) : prefs.mixOff.push(id);
}
</script>

<template>
  <section class="panel stack practice">
    <div class="row">
      <h3>Practice across sets</h3><span class="spacer"></span><span class="note">Random cards from the sets you pick</span>
    </div>
    <OptionsBox id="mix" :summary="summary">
      <div class="mixgrid">
        <span class="learnnote">Cards</span>
        <Segmented v-model="prefs.mixKind" :options="kindOptions" label="Which cards" />
        <span class="learnnote">From</span>
        <div class="chips">
          <button v-for="s in app.sets" :key="s.id" class="chip" :aria-pressed="!prefs.mixOff.includes(s.id)" @click="toggleSet(s.id)">{{ s.name }}</button>
        </div>
        <span class="learnnote">How many</span>
        <div>
          <select v-model.number="prefs.mixCount" aria-label="How many cards">
            <option v-for="c in MIX_COUNTS" :key="c" :value="c">{{ c ? `${c} cards` : "All of them" }}</option>
          </select>
        </div>
        <span class="learnnote">Show first</span>
        <Segmented v-model="prefs.dir" :options="dirOptions" label="Card direction" />
      </div>
    </OptionsBox>
    <div class="row">
      <button class="btn primary" :disabled="!ready" @click="startMix">Start</button>
      <span class="learnnote">{{ ready ? `${count(ready, "card")}, shuffled` : "No cards match. Pick another set or type." }}</span>
    </div>
  </section>
</template>
