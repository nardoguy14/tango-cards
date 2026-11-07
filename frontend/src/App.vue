<!-- The page: the header and whichever screen is showing. -->
<script setup lang="ts">
import { watch } from "vue";
import AddView from "./components/add/AddView.vue";
import LibraryView from "./components/library/LibraryView.vue";
import SetView from "./components/set/SetView.vue";
import StudyView from "./components/study/StudyView.vue";
import { app, currentSet, go } from "./store";
import { study } from "./study";

// Studying is one fixed screen: no page scroll, no rubber-band bounce.
watch(() => app.view, v => {
  document.documentElement.classList.toggle("studying", v === "study");
  if (v !== "library") scrollTo(0, 0);
}, { immediate: true });

// A screen whose set or round is gone (deleted, or a reload mid-round) falls back to a sensible one.
watch(() => [app.loaded, app.view, currentSet.value, study.round] as const, ([loaded, view, set, round]) => {
  if (!loaded || view === "library") return;
  if (!set) go("library", null, true);
  else if (view === "study" && !round) go("set", set.virtual ? null : set.id, true);
});
</script>

<template>
  <div class="wrap">
    <header class="top"><h1>単語カード <small>Tango Cards</small></h1></header>
    <main>
      <LibraryView v-if="app.view === 'library'" />
      <SetView v-else-if="app.view === 'set' && currentSet" :key="currentSet.id" :set="currentSet" />
      <AddView v-else-if="app.view === 'add' && currentSet" :key="currentSet.id" :set="currentSet" />
      <StudyView v-else-if="app.view === 'study' && currentSet && study.round" :round="study.round" :set="currentSet" />
    </main>
  </div>
</template>
