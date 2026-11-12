<!-- A set's cards, split into grammar rules and words to memorize. -->
<script setup lang="ts">
import { ref } from "vue";
import { kindOf, ofKind } from "../../lib/cards";
import { persist } from "../../store";
import type { Card, CardSet, Kind } from "../../types";
import CardTable from "./CardTable.vue";

const props = defineProps<{ set: CardSet }>();
const moved = ref<string | null>(null);   // the card that just changed group: it eases into place
const editing = ref<string | null>(null); // the card open for editing (one at a time)

const groups: { kind: Kind; title: string; sub: string }[] = [
  { kind: "grammar", title: "Grammar", sub: "particles, conjugations and patterns" },
  { kind: "word", title: "Words", sub: "vocabulary to memorize" },
];

function move(card: Card) {
  card.kind = kindOf(card) === "grammar" ? "word" : "grammar";
  moved.value = card.id;
  persist(props.set);
}
function remove(card: Card) {
  props.set.cards = props.set.cards.filter(c => c.id !== card.id);
  editing.value = null;
  persist(props.set);
}
function save(card: Card, changes: Pick<Card, "jp" | "reading" | "en" | "kind" | "table">) {
  const groupChanged = kindOf(card) !== changes.kind;
  Object.assign(card, changes);
  editing.value = null;
  if (groupChanged) moved.value = card.id; // it lands in the other table: let it ease in there
  persist(props.set);
}
</script>

<template>
  <section class="panel stack">
    <div class="row"><h3>Cards</h3><span class="spacer"></span><span class="mono muted">{{ set.cards.length }}</span></div>
    <p class="learnnote" style="margin:0">
      Tap ✎ to edit a card. Tap its <span class="kind">word</span> or <span class="kind grammar">grammar</span> tag to move it to the other group.
    </p>
    <template v-for="g in groups" :key="g.kind">
      <div class="group-head">
        <h4>{{ g.title }}</h4><span class="sub">{{ g.sub }}</span><span class="spacer"></span>
        <span class="mono muted">{{ ofKind(set.cards, g.kind).length }}</span>
      </div>
      <CardTable :cards="ofKind(set.cards, g.kind)" :kind="g.kind" :moved="moved" :editing="editing"
        @move="move" @remove="remove" @edit="c => (editing = c?.id ?? null)" @save="save" />
    </template>
  </section>
</template>
