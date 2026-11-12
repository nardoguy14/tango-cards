<!-- Adding cards to a set, on its own screen: from photos, or typed in. -->
<script setup lang="ts">
import { ref } from "vue";
import { count, kindOf } from "../../lib/cards";
import { app, back, draftFor, persist } from "../../store";
import type { Card, CardSet } from "../../types";
import PendingReview from "./PendingReview.vue";
import PhotoReader from "./PhotoReader.vue";
import TypeCard from "./TypeCard.vue";
import AdjectiveTables from "./AdjectiveTables.vue";
import CardEditor from "../set/CardEditor.vue";
import SpeakButton from "../ui/SpeakButton.vue";

const props = defineProps<{ set: CardSet }>();
const draft = draftFor(props.set.id);
const added = ref<Card[]>([]); // added on this visit, newest first
const editing = ref<string | null>(null);

async function addCards(cards: Card[]) {
  if (!cards.length) return;
  props.set.cards.push(...cards);
  added.value.unshift(...cards.slice().reverse());
  await persist(props.set);
}

// Fix a card you just added without leaving this screen. The list holds the same card objects
// as the set, so the edit lands in the set too.
async function saveEdit(card: Card, changes: Pick<Card, "jp" | "reading" | "en" | "kind" | "table">) {
  Object.assign(card, changes);
  editing.value = null;
  await persist(props.set);
}
async function removeAdded(card: Card) {
  props.set.cards = props.set.cards.filter(c => c.id !== card.id);
  added.value = added.value.filter(c => c.id !== card.id);
  editing.value = null;
  await persist(props.set);
}
</script>

<template>
  <div class="screen stack">
    <div class="row"><button class="btn ghost" @click="back('set')">← {{ set.name }}</button></div>
    <div class="add-head"><h2>Add cards</h2><span class="muted">to {{ set.name }} · {{ count(set.cards.length, "card") }} now</span></div>
    <p v-if="app.error" class="status err reveal" style="margin:0">{{ app.error }}</p>

    <PendingReview :set="set" @added="addCards" />
    <PhotoReader v-if="!draft.pending" :set="set" />
    <TypeCard @add="c => addCards([c])" />
    <AdjectiveTables v-if="!set.example" :set="set" @add="addCards" />

    <section v-if="added.length" class="panel stack reveal">
      <div class="row"><h3>Added just now</h3><span class="spacer"></span><span class="mono muted">{{ added.length }}</span></div>
      <ul class="added">
        <li v-for="(c, i) in added" :key="c.id" :style="{ '--i': i }">
          <CardEditor v-if="editing === c.id" :card="c" @save="ch => saveEdit(c, ch)" @cancel="editing = null" @remove="removeAdded(c)" />
          <div v-else class="added-row">
            <div class="added-text">
              <span class="jp" lang="ja">{{ c.jp }}<small v-if="c.reading">{{ c.reading }}</small>
                <span class="meta" :class="{ g: kindOf(c) === 'grammar' }">{{ kindOf(c) }}</span></span>
              <span class="en">{{ c.en }}</span>
            </div>
            <SpeakButton :card="c" />
            <button class="x edit" :aria-label="`Edit ${c.jp || c.en}`" title="Edit" @click="editing = c.id">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
            </button>
          </div>
        </li>
      </ul>
    </section>

    <div class="bigbar">
      <button class="btn primary" @click="back('set')">Done</button>
      <span class="learnnote">{{ added.length ? `${count(added.length, "card")} added` : "Nothing added yet" }}</span>
    </div>
  </div>
</template>
