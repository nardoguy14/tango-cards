<!-- A settings drawer: one row with a summary of the current choices; tap to fold the settings open.
     Open/closed is remembered per `id` while the app is open, so leaving a screen keeps it. -->
<script lang="ts">
import { reactive } from "vue";
const openBoxes = reactive<Record<string, boolean>>({});
</script>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ id: string; summary: string; label?: string }>(), { label: "Options" });
const open = computed({
  get: () => !!openBoxes[props.id],
  set: v => { openBoxes[props.id] = v; },
});
</script>

<template>
  <div class="opts" :class="{ open }">
    <button type="button" class="opts-head" :aria-expanded="open" :aria-controls="`opts-${id}`" @click="open = !open">
      <span class="opts-label">{{ label }}</span>
      <span class="opts-sum">{{ summary }}</span>
      <span class="chev" aria-hidden="true"></span>
    </button>
    <div :id="`opts-${id}`" class="opts-body" :inert="!open">
      <div class="opts-inner"><slot /></div>
    </div>
  </div>
</template>
