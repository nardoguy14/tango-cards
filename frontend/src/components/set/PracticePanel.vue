<!-- Practice one set: Smart learn or Review all, with their settings folded under Options. -->
<script setup lang="ts">
import { computed } from "vue";
import { DIR_LABEL, FILTER_LABEL, ofKind } from "../../lib/cards";
import { filterFor, mixedKinds, progressKey, progressSummary, putProgress } from "../../lib/progress";
import { FILTERS, LEARN_SIZES, prefs } from "../../prefs";
import { startReview, startSmart } from "../../study";
import type { CardSet, Dir } from "../../types";
import OptionsBox from "../ui/OptionsBox.vue";
import Segmented from "../ui/Segmented.vue";

const props = defineProps<{ set: CardSet }>();

const filter = computed(() => filterFor(props.set));
const deck = computed(() => ofKind(props.set.cards, filter.value));
const progress = computed(() => progressSummary(props.set));
const bothKinds = computed(() => mixedKinds(props.set));
const kindOptions = computed(() => FILTERS.map(k => ({ value: k, label: FILTER_LABEL[k], count: ofKind(props.set.cards, k).length })));
const dirOptions = (Object.keys(DIR_LABEL) as Dir[]).map(d => ({ value: d, label: DIR_LABEL[d] }));
const summary = computed(() =>
  [bothKinds.value ? FILTER_LABEL[filter.value] : "", DIR_LABEL[prefs.dir], `${prefs.learnSize} at a time`].filter(Boolean).join(" · "));

const reset = (mode: "smart" | "review") => putProgress(props.set, progressKey(mode, filter.value), null);
</script>

<template>
  <section class="panel stack practice">
    <div class="row"><h3>Practice</h3></div>
    <OptionsBox id="practice" :summary="summary">
      <div class="mixgrid">
        <template v-if="bothKinds">
          <span class="learnnote">Cards</span>
          <Segmented v-model="prefs.kindFilter" :options="kindOptions" label="Which cards" />
        </template>
        <span class="learnnote">Show first</span>
        <Segmented v-model="prefs.dir" :options="dirOptions" label="Card direction" />
        <label class="learnnote" for="learnSize">Smart learn</label>
        <div>
          <select id="learnSize" v-model.number="prefs.learnSize" aria-label="Cards in rotation at a time">
            <option v-for="n in LEARN_SIZES" :key="n" :value="n">{{ n }} cards at a time</option>
          </select>
        </div>
      </div>
    </OptionsBox>
    <div class="studybar">
      <button class="btn primary" @click="startSmart(set)">{{ progress.smart ? "Continue smart learn" : "Smart learn" }}</button>
      <button class="btn" @click="startReview(set)">{{ progress.review ? "Continue review" : `Review all ${deck.length}` }}</button>
    </div>
    <div v-if="progress.smart || progress.review" class="learnnote stack" style="gap:2px">
      <span v-if="progress.smart">Smart learn: {{ progress.cleared }} of {{ deck.length }} cleared ·
        <button class="linkbtn inline" @click="reset('smart')">Start over</button></span>
      <span v-if="progress.review">Review: {{ progress.reviewed }} of {{ deck.length }} done ·
        <button class="linkbtn inline" @click="reset('review')">Start over</button></span>
    </div>
  </section>
</template>
