<!-- Your sets as ring-bound card stacks, plus "New set". -->
<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { count, ofKind } from "../../lib/cards";
import { app, createSet, go, visibleSets } from "../../store";
import type { CardSet } from "../../types";

const sets = computed(() => visibleSets.value.slice().sort((a, b) => (a.created || 0) - (b.created || 0)));
const naming = ref(false);
const name = ref("");
const nameInput = ref<HTMLInputElement>();

const grammar = (s: CardSet) => ofKind(s.cards, "grammar").length;

async function startNaming() {
  naming.value = true;
  await nextTick();
  nameInput.value?.focus();
}
function create() {
  createSet(name.value.trim() || `Vocab ${app.sets.length + 1}`);
  name.value = ""; naming.value = false;
}
</script>

<template>
  <div class="row">
    <span class="eyebrow">Your sets</span><span class="spacer"></span>
    <span v-if="app.model" class="note">Reading images with <span class="mono">{{ app.model }}</span></span>
  </div>
  <div class="sets">
    <button v-for="(s, i) in sets" :key="s.id" class="set" :style="{ '--i': i }" @click="go('set', s.id)">
      <span class="ring" aria-hidden="true"></span>
      <span v-if="s.example" class="tag">example</span>
      <h3>{{ s.name }}</h3>
      <span class="count">
        {{ count(s.cards.length - grammar(s), "word") }}<template v-if="grammar(s)"> · <span class="g">{{ grammar(s) }} grammar</span></template><template v-if="s.image_count"> · {{ count(s.image_count, "photo") }}</template>
      </span>
      <span class="peek">{{ s.cards.slice(0, 4).map(c => c.jp).join("・") || "\u00a0" }}</span>
    </button>
    <button class="set new" :style="{ '--i': sets.length }" @click="startNaming">+ New set</button>
  </div>
  <form v-if="naming" class="newform reveal" @submit.prevent="create">
    <input ref="nameInput" v-model="name" :placeholder="`Set name, e.g. Vocab ${app.sets.length + 1}`" aria-label="New set name">
    <button class="btn primary" type="submit">Create</button>
    <button class="btn ghost" type="button" @click="naming = false">Cancel</button>
  </form>
</template>
