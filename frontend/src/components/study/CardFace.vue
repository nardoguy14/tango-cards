<!-- One side of a flashcard. The front shows the side the round asks first; the back shows both. -->
<script setup lang="ts">
import { computed } from "vue";
import { kindOf } from "../../lib/cards";
import { prefs } from "../../prefs";
import type { StudyCard } from "../../types";
import SpeakButton from "../ui/SpeakButton.vue";

const props = defineProps<{ card: StudyCard; which: "front" | "back" }>();
const showJp = computed(() => (props.which === "front") === (props.card.side === "jp-en"));
// grammar cards carry a sentence or two on the English side
const len = (t: string) => (t.length > 160 ? "xlong" : t.length > 50 ? "long" : "");
</script>

<template>
  <span class="hole" aria-hidden="true"></span>
  <span v-if="kindOf(card) === 'grammar'" class="kindtag">文法 grammar</span>
  <span class="side">{{ showJp ? "日本語" : "English" }}</span>
  <template v-if="showJp">
    <div class="big-jp" lang="ja">{{ card.jp }}</div>
    <div v-if="card.reading && (prefs.showReading || which === 'back')" class="reading" lang="ja">{{ card.reading }}</div>
    <div v-if="which === 'back'" class="sub" :class="len(card.en)">{{ card.en }}</div>
  </template>
  <template v-else>
    <div class="big-en" :class="len(card.en)">{{ card.en }}</div>
    <div v-if="which === 'back'" class="sub jp" lang="ja">{{ card.jp }}<template v-if="card.reading">（{{ card.reading }}）</template></div>
  </template>
  <span v-if="which === 'front'" class="hint">Tap to flip</span>
  <span v-if="card.from && which === 'back'" class="fromset">{{ card.from }}</span>
  <SpeakButton v-if="showJp || which === 'back'" :card="card" />
</template>
