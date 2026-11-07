<!-- Back to all sets, the set's name, and renaming it. -->
<script setup lang="ts">
import { nextTick, ref } from "vue";
import { app, back, persist, reloadAfterSaves } from "../../store";
import type { CardSet } from "../../types";

const props = defineProps<{ set: CardSet }>();
const renaming = ref(false);
const name = ref("");
const input = ref<HTMLInputElement>();

async function startRename() {
  name.value = props.set.name;
  renaming.value = true;
  await nextTick();
  input.value?.focus();
  input.value?.select();
}
async function save() {
  const v = name.value.trim();
  renaming.value = false;
  if (v && v !== props.set.name) {
    props.set.name = v;
    await persist(props.set);
  }
}
function leave() {
  back("library", null);
  reloadAfterSaves(); // fresh counts and progress on the home screen
}
</script>

<template>
  <div class="row">
    <button class="btn ghost" @click="leave">← All sets</button>
  </div>
  <div class="row">
    <form v-if="renaming" class="row" style="flex:1 1 260px;gap:8px" @submit.prevent="save">
      <input ref="input" v-model="name" aria-label="Set name" maxlength="100" style="font-size:20px;font-weight:700;flex:1 1 160px"
        @keydown.esc="renaming = false">
      <button class="btn primary" type="submit">Save</button>
      <button class="btn ghost" type="button" @click="renaming = false">Cancel</button>
    </form>
    <template v-else>
      <h2 class="setTitle">{{ set.name }}</h2>
      <button class="btn" aria-label="Rename this set" @click="startRename">Rename</button>
    </template>
    <span v-if="set.example" class="note">Example set. Add or edit anything to keep it.</span>
  </div>
  <p v-if="app.error" class="status err reveal" style="margin:0">{{ app.error }}</p>
</template>
