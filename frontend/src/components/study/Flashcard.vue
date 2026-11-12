<!-- The card on top of the pile: tap to flip, swipe to answer. A new one is created for every
     card dealt, so each slides in; flipping only turns this one over. -->
<script setup lang="ts">
import { ref } from "vue";
import { useSwipe } from "../../composables/useSwipe";
import type { StudyCard } from "../../types";
import CardFace from "./CardFace.vue";

defineProps<{ card: StudyCard; flipped: boolean }>();
const emit = defineEmits<{ flip: []; answer: [ok: boolean] }>();
const swipe = ref<HTMLElement>();
const { throwCard, wasSwiped } = useSwipe(swipe, ok => emit("answer", ok));

defineExpose({ throwCard });
</script>

<template>
  <div class="scene" :class="{ tall: card.en.length > 140 || !!card.table }">
    <div ref="swipe" class="swipe">
      <span class="stamp good" aria-hidden="true">Got it</span>
      <span class="stamp again" aria-hidden="true">Again</span>
      <div class="card" :class="{ flipped }" role="button" tabindex="0"
        aria-label="Flashcard. Press to flip, swipe right if you know it, left to see it again"
        @click="!wasSwiped() && emit('flip')" @keydown.enter.prevent="emit('flip')">
        <div class="face front"><CardFace :card="card" which="front" /></div>
        <div class="face back"><CardFace :card="card" which="back" /></div>
      </div>
    </div>
  </div>
</template>
