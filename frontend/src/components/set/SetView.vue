<!-- One set: practice it, see its cards and photos. The round + opens the add-cards screen. -->
<script setup lang="ts">
import { ref } from "vue";
import { deleteSet, go } from "../../store";
import type { CardSet } from "../../types";
import CardGroups from "./CardGroups.vue";
import PhotoGallery from "./PhotoGallery.vue";
import PracticePanel from "./PracticePanel.vue";
import SetHeader from "./SetHeader.vue";

defineProps<{ set: CardSet }>();
const confirmDelete = ref(false);
</script>

<template>
  <div class="screen stack with-fab">
    <SetHeader :set="set" />
    <PracticePanel v-if="set.cards.length" :set="set" />
    <section v-else class="panel stack">
      <h3>No cards yet</h3>
      <p class="muted" style="margin:0">Tap <b>+</b> to make cards from a photo of your notes, or type them in.</p>
    </section>
    <CardGroups :set="set" />
    <PhotoGallery v-if="!set.example" :set="set" />

    <div class="row">
      <span class="spacer"></span>
      <button v-if="!confirmDelete" class="btn ghost" @click="confirmDelete = true">Delete set</button>
      <span v-else class="row reveal">
        <span class="note">Delete “{{ set.name }}” with its cards and photos?</span>
        <button class="btn" style="color:var(--again);border-color:var(--again)" @click="deleteSet(set)">Delete</button>
        <button class="btn ghost" @click="confirmDelete = false">Keep</button>
      </span>
    </div>

    <button class="fab" aria-label="Add cards" title="Add cards" @click="go('add', set.id)">+</button>
  </div>
</template>
