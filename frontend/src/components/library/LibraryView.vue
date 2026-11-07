<!-- Home: find cards, practice across sets, and your sets. -->
<script setup lang="ts">
import { app } from "../../store";
import FindPanel from "./FindPanel.vue";
import MixPanel from "./MixPanel.vue";
import SetGrid from "./SetGrid.vue";
</script>

<template>
  <div class="screen">
    <template v-if="app.sets.length">
      <FindPanel />
      <MixPanel />
    </template>
    <SetGrid />
    <p v-if="app.error" class="status err reveal">{{ app.error }}</p>
  </div>
</template>
