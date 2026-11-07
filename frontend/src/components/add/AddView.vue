<!-- Adding cards to a set, on its own screen: from photos, or typed in. -->
<script setup lang="ts">
import { ref } from "vue";
import { count } from "../../lib/cards";
import { app, back, draftFor, persist } from "../../store";
import type { Card, CardSet } from "../../types";
import PendingReview from "./PendingReview.vue";
import PhotoReader from "./PhotoReader.vue";
import TypeCard from "./TypeCard.vue";

const props = defineProps<{ set: CardSet }>();
const draft = draftFor(props.set.id);
const added = ref<Card[]>([]); // added on this visit, newest first

async function addCards(cards: Card[]) {
  if (!cards.length) return;
  props.set.cards.push(...cards);
  added.value.unshift(...cards.slice().reverse());
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

    <section v-if="added.length" class="panel stack reveal">
      <div class="row"><h3>Added just now</h3><span class="spacer"></span><span class="mono muted">{{ added.length }}</span></div>
      <ul class="found">
        <li v-for="(c, i) in added" :key="c.id" :style="{ '--i': i }">
          <button disabled aria-pressed="true">
            <span class="tick" aria-hidden="true">✓</span>
            <span class="jp" lang="ja">{{ c.jp }}<small v-if="c.reading">{{ c.reading }}</small>
              <span class="meta" :class="{ g: c.kind === 'grammar' }">{{ c.kind }}</span></span>
            <span class="en">{{ c.en }}</span>
          </button>
        </li>
      </ul>
    </section>

    <div class="bigbar">
      <button class="btn primary" @click="back('set')">Done</button>
      <span class="learnnote">{{ added.length ? `${count(added.length, "card")} added` : "Nothing added yet" }}</span>
    </div>
  </div>
</template>
