<!-- A row of mutually exclusive choices (All / Words / Grammar, 日本語 → EN / …). -->
<script setup lang="ts" generic="T extends string">
defineProps<{ options: { value: T; label: string; count?: number }[]; label: string }>();
const model = defineModel<T>({ required: true });
</script>

<template>
  <div class="modes" role="group" :aria-label="label">
    <button v-for="o in options" :key="o.value" type="button" :aria-pressed="model === o.value" @click="model = o.value">
      {{ o.label }}<template v-if="o.count !== undefined"> <span class="mono">{{ o.count }}</span></template>
    </button>
  </div>
</template>
