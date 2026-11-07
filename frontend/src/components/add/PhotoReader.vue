<!-- Make cards from photos: new ones (drop, paste or choose) and/or pages the set already has.
     The cards that come back wait in draft.pending for review. -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { api } from "../../api";
import { count } from "../../lib/cards";
import { MAX_PAGES, readPages } from "../../lib/photos";
import { draftFor, persist } from "../../store";
import type { CardSet } from "../../types";
import OptionsBox from "../ui/OptionsBox.vue";

const props = defineProps<{ set: CardSet }>();
const draft = draftFor(props.set.id);
const over = ref(false);
const busy = ref(false);
const status = ref("");
const failed = ref(false);

// object URLs for staged photo thumbnails, released when they go
const urls = new Map<File, string>();
const thumb = (f: File) => urls.get(f) ?? (urls.set(f, URL.createObjectURL(f)), urls.get(f)!);
onUnmounted(() => urls.forEach(u => URL.revokeObjectURL(u)));

onMounted(async () => {
  if (!props.set.example && !draft.photos) {
    try { draft.photos = await api.listPhotos(props.set.id); } catch { draft.photos = []; }
  }
  addEventListener("paste", onPaste);
});
onUnmounted(() => removeEventListener("paste", onPaste));

function stage(files: File[]) {
  draft.staged.push(...files.filter(f => f.type.startsWith("image/")));
}
function onPaste(e: ClipboardEvent) {
  const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
  if (imgs.length) { e.preventDefault(); stage(imgs); }
}
function onDrop(e: DragEvent) {
  over.value = false;
  stage([...(e.dataTransfer?.files || [])]);
}
function onChoose(e: Event) {
  const input = e.target as HTMLInputElement;
  stage([...(input.files || [])]);
  input.value = "";
}
function unstage(i: number) { draft.staged.splice(i, 1); }
function togglePick(id: string) {
  const i = draft.picked.indexOf(id);
  i >= 0 ? draft.picked.splice(i, 1) : draft.picked.push(id);
}

const pages = computed(() => draft.staged.length + draft.picked.length);
const ready = computed(() => [
  draft.staged.length ? count(draft.staged.length, "new photo") : "",
  draft.picked.length ? count(draft.picked.length, "saved page") : "",
].filter(Boolean).join(" + "));

async function make() {
  let set: CardSet | undefined = props.set;
  if (set.example) set = await persist(set); // photos need a saved set; this reopens the screen for it
  if (!set || set.example) return;
  busy.value = true; failed.value = false;
  const instructions = draft.instructions.trim();
  const { found, problems } = await readPages(set.id, [...draft.staged], [...draft.picked], instructions, t => (status.value = t));
  busy.value = false;
  draft.staged = []; draft.picked = [];
  draft.photos = null; // new photos were saved: reload them
  try { draft.photos = await api.listPhotos(set.id); set.image_count = draft.photos.length; } catch { /* shown next visit */ }
  if (found.length) draft.pending = (draft.pending || []).concat(found);
  failed.value = !!problems.length || !found.length;
  status.value = problems.length
    ? (instructions ? `Couldn't make the cards: ${problems[0]}` : `Couldn't read ${problems.length === 1 ? "one photo" : problems.length + " photos"}: ${problems[0]} The photos are saved.`)
    : found.length ? ""
    : instructions ? "No cards came back for that request. Try rewording it, or check the page covers it."
    : "No Japanese words found in that image. Try a clearer or closer photo. The photo is saved.";
}
</script>

<template>
  <section class="panel stack">
    <div class="row"><h3>From a photo</h3></div>
    <OptionsBox id="instr" label="Instructions" :summary="draft.instructions.trim() || 'every vocabulary word'">
      <div class="instr">
        <label for="instr">What should the cards cover? <span class="muted">(optional)</span></label>
        <textarea id="instr" v-model="draft.instructions" rows="2" maxlength="1000"
          placeholder="e.g. Make cards for the particles に, を and へ, with an example sentence for each"></textarea>
        <span class="hint">Leave empty to pull out every vocabulary word. Write a request to make grammar cards or anything else from the page.</span>
      </div>
    </OptionsBox>

    <div class="drop" :class="{ over }" @dragover.prevent="over = true" @dragleave="over = false" @drop.prevent="onDrop">
      <strong>Add a page</strong>
      <span class="muted">Drop images here, paste a screenshot, or choose them. Add as many as you need, then tap Make cards.</span>
      <div class="row" style="justify-content:center;margin-top:10px">
        <label class="btn" for="file">{{ draft.staged.length ? "Add more images" : "Choose images" }}</label>
        <input id="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden @change="onChoose">
      </div>
      <div v-if="draft.staged.length" class="thumbs">
        <span v-for="(f, i) in draft.staged" :key="thumb(f)" class="thumb reveal">
          <img :alt="f.name" :src="thumb(f)">
          <button class="thumbx" aria-label="Remove this photo" @click="unstage(i)">×</button>
        </span>
      </div>
    </div>

    <template v-if="draft.photos?.length">
      <div class="learnnote">Or read pages this set already has again:</div>
      <div class="picks">
        <button v-for="p in draft.photos" :key="p.id" class="pick" :aria-pressed="draft.picked.includes(p.id)"
          :aria-label="`Use ${p.filename}`" @click="togglePick(p.id)">
          <img :alt="p.filename" loading="lazy" :src="p.url"><span class="badge" aria-hidden="true">✓</span>
        </button>
      </div>
    </template>

    <div class="row makebar">
      <span class="learnnote">{{ pages > MAX_PAGES ? `That's ${pages} pages. Use ${MAX_PAGES} or fewer at a time.` : pages ? `Ready: ${ready}` : "Nothing added yet" }}</span>
      <span class="spacer"></span>
      <button v-if="draft.staged.length && !busy" class="btn ghost" @click="draft.staged = []">Clear</button>
      <button class="btn primary" :disabled="busy || !pages || pages > MAX_PAGES" @click="make">Make cards</button>
    </div>
    <p v-if="status" class="status reveal" :class="{ err: failed }" style="margin:0">{{ status }}</p>
  </section>
</template>
