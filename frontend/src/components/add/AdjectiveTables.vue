<!-- Conjugation tables: finds the set's い- and な-adjectives and makes one table card for each,
     with its polite present and past forms (affirmative and negative). The guesses can be
     corrected: untick a word, or switch it between い and な. -->
<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { count, uid } from "../../lib/cards";
import { ADJ_LABEL, adjectiveType, conjugate, dictionaryForm, tableCard, type AdjType } from "../../lib/conjugate";
import type { Card, CardSet } from "../../types";

const props = defineProps<{ set: CardSet }>();
const emit = defineEmits<{ add: [cards: Card[]] }>();

// adjectives that already have a table card in this set are left out
const tabled = computed(() => new Set(props.set.cards.filter(c => c.table).map(c => c.jp)));
const found = computed(() => props.set.cards
  .map(card => ({ card, type: adjectiveType(card) }))
  .filter((x): x is { card: Card; type: AdjType } => !!x.type && !tabled.value.has(dictionaryForm(x.card.jp))));

// the learner's corrections, by card id: every found adjective starts ticked, with the guessed type
const choice = reactive<Record<string, { on: boolean; type: AdjType }>>({});
watch(found, list => list.forEach(x => { choice[x.card.id] ??= { on: true, type: x.type }; }), { immediate: true });
const chosen = computed(() => found.value.filter(x => choice[x.card.id]?.on));

function make() {
  emit("add", chosen.value.map(x => tableCard(x.card, choice[x.card.id].type, uid())));
}
</script>

<template>
  <section class="panel stack">
    <div class="row"><h3>Conjugation tables</h3><span class="spacer"></span><span class="note">present &amp; past, polite forms</span></div>
    <p v-if="!found.length" class="muted" style="margin:0">
      {{ tabled.size ? "Every adjective in this set has its table card." :
        "No adjectives found in this set. Words ending in い, or marked (な), show up here." }}
    </p>
    <template v-else>
      <p class="learnnote" style="margin:0">
        One card per adjective: the front asks for its forms, the back shows them as a table. Untick any that aren't adjectives,
        or switch い / な if it guessed wrong.
      </p>
      <ul class="adjs">
        <li v-for="(x, i) in found" :key="x.card.id" :class="{ off: !choice[x.card.id].on }" :style="{ '--i': i }">
          <label class="adj-pick">
            <input v-model="choice[x.card.id].on" type="checkbox">
            <span class="jp" lang="ja">{{ dictionaryForm(x.card.jp) }}</span>
          </label>
          <span class="kindseg" role="group" :aria-label="`${dictionaryForm(x.card.jp)} is a`">
            <button v-for="t in (['i', 'na'] as AdjType[])" :key="t" type="button" :aria-pressed="choice[x.card.id].type === t"
              :title="ADJ_LABEL[t]" @click="choice[x.card.id].type = t">{{ t === "i" ? "い" : "な" }}</button>
          </span>
          <span class="adj-forms" lang="ja">{{ conjugate(dictionaryForm(x.card.jp), choice[x.card.id].type).join(" · ") }}</span>
        </li>
      </ul>
      <div class="row">
        <button class="btn primary" :disabled="!chosen.length" @click="make">Add {{ count(chosen.length, "table card") }}</button>
      </div>
    </template>
  </section>
</template>
