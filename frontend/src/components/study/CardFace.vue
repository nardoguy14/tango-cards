<!-- One side of a flashcard. The front shows the side the round asks first; the back shows both.
     A table card (conjugations) always asks with the word, and shows its table on the back. -->
<script setup lang="ts">
import { computed } from "vue";
import { kindOf } from "../../lib/cards";
import { speak } from "../../lib/speech";
import { prefs } from "../../prefs";
import type { StudyCard } from "../../types";
import SpeakButton from "../ui/SpeakButton.vue";

const props = defineProps<{ card: StudyCard; which: "front" | "back" }>();
const showJp = computed(() => !!props.card.table || (props.which === "front") === (props.card.side === "jp-en"));
// grammar cards carry a sentence or two on the English side
const len = (t: string) => (t.length > 160 ? "xlong" : t.length > 50 ? "long" : "");
// a long form may wrap, but only before です / でした / じゃ: 安かった|です, not 安かったで|す
const parts = (form: string) => form.split(/(?=じゃ|でした|です)/);
</script>

<template>
  <span class="hole" aria-hidden="true"></span>
  <span v-if="kindOf(card) === 'grammar'" class="kindtag">文法 grammar</span>
  <span class="side">{{ card.table ? "活用 forms" : showJp ? "日本語" : "English" }}</span>

  <!-- conjugation table card: tap a form to hear it -->
  <template v-if="card.table">
    <template v-if="which === 'front'">
      <div class="big-jp" lang="ja">{{ card.jp }}</div>
      <div v-if="card.reading && prefs.showReading" class="reading" lang="ja">{{ card.reading }}</div>
      <div class="sub">Present and past, affirmative and negative?</div>
    </template>
    <template v-else>
      <div class="table-word" lang="ja">{{ card.jp }}<span v-if="card.reading">（{{ card.reading }}）</span></div>
      <table class="conj">
        <thead><tr><th v-for="(h, i) in card.table[0]" :key="i">{{ h }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, r) in card.table.slice(1)" :key="r">
            <th>{{ row[0] }}</th>
            <td v-for="(cell, i) in row.slice(1)" :key="i" lang="ja">
              <button type="button" class="say" :aria-label="`Hear ${cell}`" @click.stop="speak(cell)" @pointerdown.stop @touchstart.stop>
                <template v-for="(part, k) in parts(cell)" :key="k"><wbr v-if="k">{{ part }}</template>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div class="table-en">{{ card.en }}</div>
    </template>
  </template>

  <!-- ordinary card -->
  <template v-else-if="showJp">
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
