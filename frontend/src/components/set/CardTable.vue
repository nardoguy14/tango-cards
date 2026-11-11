<!-- One group of a set's cards (grammar or words). The tag moves a card to the other group. -->
<script setup lang="ts">
import { api } from "../../api";
import type { Card, Kind } from "../../types";
import SpeakButton from "../ui/SpeakButton.vue";

defineProps<{ cards: Card[]; kind: Kind; moved: string | null }>();
defineEmits<{ move: [card: Card]; remove: [card: Card] }>();
const other = { grammar: "words", word: "grammar" } as const;
</script>

<template>
  <div class="tablewrap">
    <table>
      <thead><tr><th>Japanese</th><th>Reading</th><th>English</th><th></th></tr></thead>
      <tbody>
        <tr v-for="(c, i) in cards" :key="c.id" :class="{ moved: moved === c.id }" :style="{ '--i': i }">
          <td class="jp">{{ c.jp }}</td>
          <td class="rd">{{ c.reading }}</td>
          <td>{{ c.en }}</td>
          <td class="acts">
            <SpeakButton :card="c" />
            <button class="kind" :class="{ grammar: kind === 'grammar' }" :aria-label="`Move to ${other[kind]}`" :title="`Move to ${other[kind]}`"
              @click="$emit('move', c)">{{ kind }}</button>
            <a v-if="c.image_id" class="src" :href="api.photoUrl(c.image_id)" target="_blank" rel="noopener" title="Open the photo this card came from">
              <img alt="Source photo" loading="lazy" :src="api.photoUrl(c.image_id)"></a>
            <button class="x" aria-label="Delete card" @click="$emit('remove', c)">×</button>
          </td>
        </tr>
        <tr v-if="!cards.length">
          <td colspan="4" class="muted">{{ kind === "grammar" ? "No grammar cards yet." : "No words yet." }} Tap + to add some.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
