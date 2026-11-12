<!-- One group of a set's cards (grammar or words). The tag moves a card to the other group;
     ✎ opens it for editing right there in the list. -->
<script setup lang="ts">
import { api } from "../../api";
import type { Card, Kind } from "../../types";
import SpeakButton from "../ui/SpeakButton.vue";
import CardEditor from "./CardEditor.vue";

defineProps<{ cards: Card[]; kind: Kind; moved: string | null; editing: string | null }>();
defineEmits<{
  move: [card: Card]; remove: [card: Card]; edit: [card: Card | null];
  save: [card: Card, changes: Pick<Card, "jp" | "reading" | "en" | "kind" | "table">];
}>();
const other = { grammar: "words", word: "grammar" } as const;
</script>

<template>
  <div class="tablewrap">
    <table>
      <thead><tr><th>Japanese</th><th>Reading</th><th>English</th><th></th></tr></thead>
      <tbody>
        <template v-for="(c, i) in cards" :key="c.id">
          <tr v-if="editing === c.id" class="editing">
            <td colspan="4">
              <CardEditor :card="c" @save="ch => $emit('save', c, ch)" @cancel="$emit('edit', null)" @remove="$emit('remove', c)" />
            </td>
          </tr>
          <tr v-else :class="{ moved: moved === c.id }" :style="{ '--i': i }">
            <td class="jp">{{ c.jp }}</td>
            <td class="rd">{{ c.reading }}</td>
            <td>{{ c.en }}<div v-if="c.table" class="mini"><table class="conj">
              <tr v-for="(row, r) in c.table" :key="r"><component :is="r && j ? 'td' : 'th'" v-for="(cell, j) in row" :key="j" :lang="r && j ? 'ja' : undefined">{{ cell }}</component></tr>
            </table></div></td>
            <td class="acts">
              <SpeakButton :card="c" />
              <button class="kind" :class="{ grammar: kind === 'grammar' }" :aria-label="`Move to ${other[kind]}`" :title="`Move to ${other[kind]}`"
                @click="$emit('move', c)">{{ kind }}</button>
              <a v-if="c.image_id" class="src" :href="api.photoUrl(c.image_id)" target="_blank" rel="noopener" title="Open the photo this card came from">
                <img alt="Source photo" loading="lazy" :src="api.photoUrl(c.image_id)"></a>
              <button class="x edit" :aria-label="`Edit ${c.jp || c.en}`" title="Edit" @click="$emit('edit', c)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
              </button>
            </td>
          </tr>
        </template>
        <tr v-if="!cards.length">
          <td colspan="4" class="muted">{{ kind === "grammar" ? "No grammar cards yet." : "No words yet." }} Tap + to add some.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
