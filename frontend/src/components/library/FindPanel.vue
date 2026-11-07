<!-- Find cards: ask for a topic, refine it, leave out what you don't want, practice the rest. -->
<script setup lang="ts">
import { computed } from "vue";
import { ask, clear, finder, kept, practiceFound, toggle } from "../../finder";
import { count, FILTER_LABEL, kindOf, ofKind } from "../../lib/cards";
import { FILTERS } from "../../prefs";
import { app } from "../../store";
import Segmented from "../ui/Segmented.vue";

const down = computed(() => !app.helperUp && !finder.turns.length);
const shown = computed(() => ofKind(finder.results, finder.kind));
const keptCount = computed(() => kept().length);
const kindOptions = computed(() => FILTERS.map(k => ({ value: k, label: FILTER_LABEL[k], count: ofKind(finder.results, k).length })));
const bothKinds = computed(() => kindOptions.value.every(o => o.count));

function submit() {
  const text = finder.draft.trim();
  if (text && !finder.busy) ask(text);
}
</script>

<template>
  <section class="panel stack">
    <div class="row">
      <h3>Find cards</h3>
      <span class="spacer"></span>
      <button v-if="finder.turns.length" class="btn ghost" @click="clear">Clear</button>
      <span v-else class="note">Ask for a topic across all your sets</span>
    </div>

    <div v-if="finder.turns.length" class="convo" aria-live="polite">
      <template v-for="(t, i) in finder.turns" :key="i">
        <div v-if="t.role === 'user'" class="bubble me reveal">{{ t.text }}</div>
        <div v-else class="bubble bot reveal">{{ t.text || "Here they are." }}<span class="n">{{ count(t.ids.length, "card") }}</span></div>
      </template>
      <div v-if="finder.busy" class="bubble bot wait reveal">Looking through your cards <i></i><i></i><i></i></div>
    </div>

    <p v-if="finder.error" class="status err reveal" style="margin:0">{{ finder.error }}</p>

    <div v-if="finder.results.length && !finder.busy" class="stack reveal" style="gap:10px">
      <Segmented v-if="bothKinds" v-model="finder.kind" :options="kindOptions" label="Which of the found cards" />
      <ul class="found">
        <li v-for="(c, i) in shown" :key="c.id" :style="{ '--i': i }">
          <button :aria-pressed="!finder.off.includes(c.id)" @click="toggle(c.id)">
            <span class="tick" aria-hidden="true">✓</span>
            <span class="jp" lang="ja">{{ c.jp }}<small v-if="c.reading">{{ c.reading }}</small>
              <span class="meta" :class="{ g: kindOf(c) === 'grammar' }">{{ kindOf(c) === "grammar" ? "grammar · " : "" }}{{ c.set_name }}</span></span>
            <span class="en">{{ c.en }}</span>
          </button>
        </li>
      </ul>
      <div class="row">
        <button class="btn primary" :disabled="!keptCount" @click="practiceFound">Practice</button>
        <span class="learnnote">{{ count(keptCount, "card") }} · tap a card to {{ finder.off.length ? "put it back" : "leave it out" }}</span>
      </div>
    </div>

    <form class="ask" @submit.prevent="submit">
      <input v-model="finder.draft" maxlength="500" autocomplete="off" aria-label="What cards do you want?"
        :placeholder="finder.results.length ? 'Refine: only verbs, add the months…' : 'e.g. cards about days of the week'"
        :disabled="finder.busy || down">
      <button class="btn primary" type="submit" :disabled="finder.busy || down">Ask</button>
    </form>
    <p v-if="down" class="note" style="margin:0">
      The local model (<span class="mono">{{ app.helper || "qwen" }}</span>) isn't running, so the finder is off. Practice below still works.
    </p>
  </section>
</template>
