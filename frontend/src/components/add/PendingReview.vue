<!-- Cards the model found, before they join the set: fix them, mark word or grammar, drop any. -->
<script setup lang="ts">
import { kindOf, uid } from "../../lib/cards";
import { draftFor } from "../../store";
import type { Card, CardSet } from "../../types";

const props = defineProps<{ set: CardSet }>();
const emit = defineEmits<{ added: [cards: Card[]] }>();
const draft = draftFor(props.set.id);

const rows = (en: string) => (en.length > 80 ? 3 : en.length > 35 ? 2 : 1);

function add() {
  const cards = (draft.pending || [])
    .filter(c => c.jp.trim() || c.en.trim())
    .map(c => ({ id: uid(), jp: c.jp.trim(), reading: c.reading.trim(), en: c.en.trim(), kind: kindOf(c), ...(c.image_id ? { image_id: c.image_id } : {}) }));
  draft.pending = null;
  emit("added", cards);
}
</script>

<template>
  <section v-if="draft.pending" class="panel review stack">
    <div class="row">
      <h3>{{ draft.pending.length ? `Found ${draft.pending.length} card${draft.pending.length === 1 ? "" : "s"}` : "All removed" }}</h3>
      <span class="spacer"></span><span class="note">Fix anything, check each is a word or grammar, remove what you don't want</span>
    </div>
    <ol class="pcards">
      <li v-for="(c, i) in draft.pending" :key="i" class="pcard" :style="{ '--i': i }">
        <div class="pcard-head">
          <span class="mono muted">{{ i + 1 }}</span>
          <span class="kindseg" role="group" :aria-label="`Card ${i + 1} type`">
            <button :aria-pressed="kindOf(c) === 'word'" @click="c.kind = 'word'">Word</button>
            <button :aria-pressed="kindOf(c) === 'grammar'" @click="c.kind = 'grammar'">Grammar</button>
          </span>
          <button class="btn remove" :aria-label="`Remove card ${i + 1}`" @click="draft.pending.splice(i, 1)">Remove</button>
        </div>
        <div class="pcard-row">
          <label>Japanese<input v-model="c.jp" class="jpin"></label>
          <label>Reading<input v-model="c.reading" class="jpin"></label>
        </div>
        <label>English<textarea v-model="c.en" :rows="rows(c.en)"></textarea></label>
      </li>
    </ol>
    <div class="confirm">
      <button class="btn primary" :disabled="!draft.pending.length" @click="add">Add {{ draft.pending.length }} to {{ set.name }}</button>
      <button class="btn ghost" @click="draft.pending = null">Discard all</button>
    </div>
  </section>
</template>
