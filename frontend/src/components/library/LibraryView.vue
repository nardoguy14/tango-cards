<!-- Home: your sets, with Find cards and Practice across sets as dropdowns from the menu bar. -->
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { finder } from "../../finder";
import { app } from "../../store";
import FindPanel from "./FindPanel.vue";
import MixPanel from "./MixPanel.vue";
import SetGrid from "./SetGrid.vue";

type Menu = "find" | "practice";
const open = ref<Menu | null>(null);
const sheet = ref<HTMLElement>();
const caretX = ref(40); // the pointer sits under the button that opened the sheet

async function toggle(menu: Menu, e: MouseEvent) {
  const btn = e.currentTarget as HTMLElement;
  caretX.value = btn.offsetLeft + btn.offsetWidth / 2;
  open.value = open.value === menu ? null : menu;
  await nextTick();
  // a keyboard user lands in the panel; on phones, don't pop the on-screen keyboard uninvited
  if (open.value && matchMedia("(pointer: fine)").matches) sheet.value?.querySelector<HTMLElement>("input, button")?.focus();
}
const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") open.value = null; };
onMounted(() => addEventListener("keydown", onKey));
onUnmounted(() => removeEventListener("keydown", onKey));
</script>

<template>
  <div class="screen">
    <div v-if="app.sets.length" class="menubar" :class="{ open }" :style="{ '--caret-x': `${caretX}px` }">
      <div class="menu-btns">
        <button class="menu-btn" :aria-expanded="open === 'find'" aria-controls="menu-sheet" @click="toggle('find', $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          Find<span v-if="finder.results.length && open !== 'find'" class="dot" aria-label="(has results)"></span>
        </button>
        <button class="menu-btn" :aria-expanded="open === 'practice'" aria-controls="menu-sheet" @click="toggle('practice', $event)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h11l-3-3M20 17H9l3 3" /><path d="M15 7l5 0M4 17h5" /></svg>
          Practice
        </button>
      </div>
      <Transition name="fade"><span v-if="open" class="caret" aria-hidden="true"></span></Transition>
      <Transition name="drop">
        <div v-if="open" id="menu-sheet" ref="sheet" class="menu-sheet" role="dialog"
          :aria-label="open === 'find' ? 'Find cards' : 'Practice across sets'">
          <FindPanel v-if="open === 'find'" />
          <MixPanel v-else />
        </div>
      </Transition>
    </div>
    <Transition name="fade"><div v-if="open" class="scrim" @click="open = null"></div></Transition>

    <SetGrid />
    <p v-if="app.error" class="status err reveal">{{ app.error }}</p>
  </div>
</template>
