<!-- The photos a set was made from, how many cards each gave, and deleting them. -->
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../../api";
import { count } from "../../lib/cards";
import { draftFor } from "../../store";
import type { CardSet } from "../../types";

const props = defineProps<{ set: CardSet }>();
const draft = draftFor(props.set.id);
const error = ref("");
const confirming = ref<string | null>(null);

const used = computed(() => {
  const m = new Map<string, number>();
  props.set.cards.forEach(c => c.image_id && m.set(c.image_id, (m.get(c.image_id) || 0) + 1));
  return m;
});

onMounted(async () => {
  if (draft.photos) return;
  try { draft.photos = await api.listPhotos(props.set.id); }
  catch (e) { error.value = "Couldn't load photos: " + (e as Error).message; }
});

async function remove(id: string) {
  try { await api.deletePhoto(id); }
  catch (e) { error.value = "Couldn't delete the photo: " + (e as Error).message; return; }
  draft.photos = (draft.photos || []).filter(p => p.id !== id);
  draft.picked = draft.picked.filter(p => p !== id);
  props.set.image_count = draft.photos.length;
}
</script>

<template>
  <section class="panel stack">
    <div class="row"><h3>Photos</h3><span class="spacer"></span><span class="mono muted">{{ draft.photos?.length || "" }}</span></div>
    <p v-if="error" class="status err">{{ error }}</p>
    <span v-else-if="!draft.photos" class="muted">Loading photos…</span>
    <span v-else-if="!draft.photos.length" class="muted">Photos you add are kept here.</span>
    <div v-else class="photos">
      <figure v-for="(p, i) in draft.photos" :key="p.id" class="photo reveal" :style="{ animationDelay: `${Math.min(i, 12) * 30}ms` }">
        <a :href="p.url" target="_blank" rel="noopener"><img :alt="p.filename" loading="lazy" :src="p.url"></a>
        <figcaption>
          <span>{{ count(used.get(p.id) || 0, "card") }}</span>
          <span v-if="confirming === p.id" class="row" style="gap:4px">
            <button class="linkbtn danger" @click="remove(p.id)">Delete</button>
            <button class="linkbtn" @click="confirming = null">Keep</button>
          </span>
          <button v-else class="x" aria-label="Delete photo" @click="confirming = p.id">×</button>
        </figcaption>
      </figure>
    </div>
  </section>
</template>
