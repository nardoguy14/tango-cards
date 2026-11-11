<!-- Edit a saved card in place: its Japanese, reading, English and whether it's a word or a
     grammar rule. Changes are kept only on Save; Delete asks first. -->
<script setup lang="ts">
import { nextTick, onMounted, reactive, ref } from "vue";
import { kindOf } from "../../lib/cards";
import type { Card, Kind } from "../../types";
import Segmented from "../ui/Segmented.vue";

const props = defineProps<{ card: Card }>();
const emit = defineEmits<{ save: [changes: Pick<Card, "jp" | "reading" | "en" | "kind">]; cancel: []; remove: [] }>();

const form = reactive({ jp: props.card.jp, reading: props.card.reading, en: props.card.en, kind: kindOf(props.card) as Kind });
const confirming = ref(false);
const first = ref<HTMLInputElement>();
const kinds = [{ value: "word" as Kind, label: "Word" }, { value: "grammar" as Kind, label: "Grammar" }];
const rows = (en: string) => (en.length > 120 ? 4 : en.length > 50 ? 3 : 2);

onMounted(async () => { await nextTick(); first.value?.focus({ preventScroll: true }); });

function save() {
  const changes = { jp: form.jp.trim(), reading: form.reading.trim(), en: form.en.trim(), kind: form.kind };
  if (changes.jp || changes.en) emit("save", changes);
}
</script>

<template>
  <form class="editor reveal" @submit.prevent="save" @keydown.esc="emit('cancel')">
    <div class="editor-head">
      <span class="eyebrow">Edit card</span>
      <Segmented v-model="form.kind" :options="kinds" label="Card type" />
    </div>
    <div class="typed">
      <label>Japanese<input ref="first" v-model="form.jp" class="jpin" maxlength="200"></label>
      <label>Reading<input v-model="form.reading" class="jpin" maxlength="200" placeholder="よみ"></label>
      <label class="wide">English<textarea v-model="form.en" maxlength="600" :rows="rows(form.en)"></textarea></label>
    </div>
    <div class="row">
      <button class="btn primary" type="submit" :disabled="!form.jp.trim() && !form.en.trim()">Save</button>
      <button class="btn ghost" type="button" @click="emit('cancel')">Cancel</button>
      <span class="spacer"></span>
      <template v-if="confirming">
        <span class="note">Delete this card?</span>
        <button class="btn remove" type="button" @click="emit('remove')">Delete</button>
        <button class="btn ghost" type="button" @click="confirming = false">Keep</button>
      </template>
      <button v-else class="btn ghost danger" type="button" @click="confirming = true">Delete</button>
    </div>
  </form>
</template>
