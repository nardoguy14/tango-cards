<!-- Type a card in by hand. Stays open for the next one; cards added here are listed below it. -->
<script setup lang="ts">
import { nextTick, reactive, ref } from "vue";
import { uid } from "../../lib/cards";
import type { Card, Kind } from "../../types";
import Segmented from "../ui/Segmented.vue";

const emit = defineEmits<{ add: [card: Card] }>();
const form = reactive({ jp: "", reading: "", en: "", kind: "word" as Kind });
const jpInput = ref<HTMLInputElement>();
const kinds = [{ value: "word" as Kind, label: "Word" }, { value: "grammar" as Kind, label: "Grammar" }];

async function add() {
  const card = { id: uid(), jp: form.jp.trim(), reading: form.reading.trim(), en: form.en.trim(), kind: form.kind };
  if (!card.jp && !card.en) return;
  emit("add", card);
  Object.assign(form, { jp: "", reading: "", en: "" });
  await nextTick();
  jpInput.value?.focus();
}
</script>

<template>
  <section class="panel stack">
    <div class="row"><h3>Type one in</h3><span class="spacer"></span>
      <Segmented v-model="form.kind" :options="kinds" label="Card type" />
    </div>
    <form class="typed" @submit.prevent="add">
      <label>Japanese<input ref="jpInput" v-model="form.jp" class="jpin" :placeholder="form.kind === 'grammar' ? '〜ます' : '日本語'"></label>
      <label>Reading<input v-model="form.reading" class="jpin" placeholder="よみ"></label>
      <label class="wide">English<input v-model="form.en" :placeholder="form.kind === 'grammar' ? 'What the rule does' : 'English'"></label>
      <div class="wide row"><button class="btn primary" type="submit" :disabled="!form.jp.trim() && !form.en.trim()">Add</button></div>
    </form>
  </section>
</template>
