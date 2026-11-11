<!-- 🔊 Hear a card in Japanese. Tap again right away to hear it slowly. Hidden when the
     browser can't speak, or there's no Japanese to say. It never flips or swipes the card it
     sits on. -->
<script setup lang="ts">
import { computed } from "vue";
import { speakCard, speech, spokenText } from "../../lib/speech";
import type { Card } from "../../types";

const props = defineProps<{ card: Card }>();
const text = computed(() => spokenText(props.card));
</script>

<template>
  <button v-if="speech.supported && text" type="button" class="speak" :class="{ playing: speech.playing === card.id }"
    :aria-label="`Hear ${text}`" title="Hear it (tap again for slow)"
    @click.stop="speakCard(card)" @pointerdown.stop @touchstart.stop @keydown.enter.stop>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path class="body" d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
      <path class="wave w1" d="M15.5 9a4 4 0 0 1 0 6" />
      <path class="wave w2" d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  </button>
</template>
