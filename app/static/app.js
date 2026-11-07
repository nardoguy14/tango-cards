(() => {
  const $view = document.getElementById("view");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // ---------- example set (shown only until you save your own) ----------
  const EXAMPLE_DATA = {
    id: "example", example: true, name: "Example: Vocab 1",
    cards: [
      { id: "e1", jp: "水", reading: "みず", en: "water" },
      { id: "e2", jp: "食べる", reading: "たべる", en: "to eat" },
      { id: "e3", jp: "学校", reading: "がっこう", en: "school" },
      { id: "e4", jp: "ありがとう", reading: "", en: "thank you" },
      { id: "e5", jp: "電車", reading: "でんしゃ", en: "train" },
      { id: "e6", jp: "猫", reading: "ねこ", en: "cat" },
    ],
  };

  let EXAMPLE = structuredClone(EXAMPLE_DATA);

  // ---------- storage: the Tango Cards API ----------
  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { const j = await res.json(); detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }
  const store = {
    model: "", helper: "", helperUp: false,
    async init() { try { const h = await api("GET", "/api/health"); this.model = h.model; this.helper = h.helper; this.helperUp = h.helper_up; } catch {} },
    list: () => api("GET", "/api/sets"),
    create: set => api("POST", "/api/sets", { name: set.name, cards: set.cards }),
    save: set => api("PUT", `/api/sets/${encodeURIComponent(set.id)}`, { name: set.name, cards: set.cards }),
    remove: id => api("DELETE", `/api/sets/${encodeURIComponent(id)}`),
  };

  const LEARN_SIZES = [3, 5, 7, 10, 15, 20];
  const MIX_COUNTS = [10, 20, 30, 50, 0];   // 0 = every matching card
  const FILTERS = ["all", "word", "grammar"];
  const state = { sets: [], images: {}, selImgs: {}, instr: "", view: "library", setId: null, pending: null, study: null, dir: "jp-en", showReading: true, learnSize: 7, staged: {},
    kindFilter: "all", mixKind: "all", mixCount: 20, mixOff: new Set(), mixSet: null, moved: null,
    opts: {},
    find: { turns: [], results: [], kind: "all", off: new Set(), busy: false, error: "", draft: "", fresh: false } };
  try {
    const p = JSON.parse(localStorage.getItem("tango-prefs") || "{}");
    if (p.dir) state.dir = p.dir; if (p.showReading === false) state.showReading = false; if (LEARN_SIZES.includes(p.learnSize)) state.learnSize = p.learnSize;
    if (FILTERS.includes(p.kindFilter)) state.kindFilter = p.kindFilter;
    if (FILTERS.includes(p.mixKind)) state.mixKind = p.mixKind;
    if (MIX_COUNTS.includes(p.mixCount)) state.mixCount = p.mixCount;
    if (Array.isArray(p.mixOff)) state.mixOff = new Set(p.mixOff);
  } catch {}
  const savePrefs = () => { try { localStorage.setItem("tango-prefs", JSON.stringify({ dir: state.dir, showReading: state.showReading, learnSize: state.learnSize,
    kindFilter: state.kindFilter, mixKind: state.mixKind, mixCount: state.mixCount, mixOff: [...state.mixOff] })); } catch {} };

  // A card is a grammar rule (particles, conjugations, patterns) or a word to memorize.
  const kindOf = c => c.kind === "grammar" ? "grammar" : "word";
  const ofKind = (cards, k) => k === "all" ? cards : cards.filter(c => kindOf(c) === k);
  const FILTER_LABEL = { all: "All", word: "Words", grammar: "Grammar" };

  const visibleSets = () => state.sets.length ? state.sets : [EXAMPLE];
  // "mix" is a practice round drawn from several sets; it isn't saved anywhere
  const currentSet = () => state.setId === "mix" ? state.mixSet : visibleSets().find(s => s.id === state.setId);

  async function persist(set) {
    try {
      if (set.example) {             // editing the example turns it into a real set
        set.name = set.name.replace(/^Example:\s*/, "");
        const saved = await store.create(set);
        set.example = false; set.id = saved.id; set.created = saved.created;
        state.sets.push(set); state.setId = set.id;
        EXAMPLE = structuredClone(EXAMPLE_DATA);
      } else {
        await store.save(set);
      }
    } catch (e) { flash("Couldn't save: " + (e?.message || "the server didn't respond")); }
  }
  let flashMsg = "";
  function flash(m) { flashMsg = m; render(); }

  // ---------- rendering ----------
  // Most actions just redraw the current screen. Moving to another screen (library, a set,
  // studying) cross-fades with a View Transition where the browser has one, and the new
  // screen's tiles and rows ease in one after another ("fresh"); plain redraws don't animate.
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let lastWhere = "";
  function render() {
    const where = state.view + ":" + state.setId;
    const changed = where !== lastWhere;
    lastWhere = where;
    if (changed && document.startViewTransition && !reduceMotion() && $view.childElementCount) {
      document.startViewTransition(() => draw(true));
    } else draw(changed);
  }
  function draw(fresh) {
    const studying = state.view === "study";
    if (studying && !document.documentElement.classList.contains("studying")) window.scrollTo(0, 0);
    document.documentElement.classList.toggle("studying", studying);
    $view.classList.toggle("fresh", fresh);
    if (fresh && !document.startViewTransition) { $view.classList.remove("enter"); void $view.offsetWidth; $view.classList.add("enter"); }
    if (state.view === "library") renderLibrary();
    else if (state.view === "set") renderSet();
    else if (state.view === "study") renderStudy();
    state.moved = null; state.find.fresh = false; pendingFresh = false;
  }
  let pendingFresh = false;     // cards just came back from a photo: let them cascade in

  // ---------- options disclosure: settings fold away under one row with a summary ----------
  // Open/closed lives in state.opts so the app's frequent redraws keep it; only a tap animates.
  const DIR_LABEL = { "jp-en": "日本語 → EN", "en-jp": "EN → 日本語", mix: "Mixed" };
  function optionsBox(key, summary, inner, label = "Options") {
    const open = !!state.opts[key];
    return `<div class="opts${open ? " open" : ""}" data-opts="${key}">
      <button type="button" class="opts-head" aria-expanded="${open}" aria-controls="opts-${key}">
        <span class="opts-label">${label}</span><span class="opts-sum">${summary}</span><span class="chev" aria-hidden="true"></span>
      </button>
      <div class="opts-body" id="opts-${key}" ${open ? "" : "inert"}><div class="opts-inner">${inner}</div></div>
    </div>`;
  }
  function bindOptions() {
    $view.querySelectorAll("[data-opts]").forEach(box => {
      const head = box.querySelector(".opts-head"), body = box.querySelector(".opts-body");
      head.onclick = () => {
        const open = !box.classList.contains("open");
        state.opts[box.dataset.opts] = open;
        box.classList.toggle("open", open);
        head.setAttribute("aria-expanded", open);
        body.toggleAttribute("inert", !open);
      };
    });
  }

  // Cards for a practice round across sets: every chosen set, filtered by kind, shuffled, capped.
  function mixPool() {
    const sets = state.sets.filter(s => !state.mixOff.has(s.id));
    return sets.flatMap(s => ofKind(s.cards, state.mixKind).map(c => ({ ...c, from: s.name })));
  }
  function startMix() {
    const pool = shuffle(mixPool());
    const cards = state.mixCount ? pool.slice(0, state.mixCount) : pool;
    if (!cards.length) return;
    const label = state.mixKind === "all" ? "Mixed practice" : `Mixed ${FILTER_LABEL[state.mixKind].toLowerCase()}`;
    state.mixSet = { id: "mix", virtual: true, name: label, cards, progress: {} };
    state.setId = "mix";
    startStudy(state.mixSet, cards);
  }

  // ---------- card finder: ask the local model for cards on a topic, then practice them ----------
  const findKept = () => { const f = state.find; return ofKind(f.results, f.kind).filter(c => !f.off.has(c.id)); };

  function findPanel() {
    if (!state.sets.length) return "";
    const f = state.find, last = f.turns.length - 1;
    const kept = findKept();
    const count = k => ofKind(f.results, k).length;
    const seg = k => `<button data-fkind="${k}" aria-pressed="${f.kind === k}">${FILTER_LABEL[k]} <span class="mono">${count(k)}</span></button>`;
    const down = !store.helperUp && !f.turns.length;
    return `<section class="panel stack" id="findPanel">
      <div class="row"><h3>Find cards</h3><span class="spacer"></span>
        ${f.turns.length ? `<button class="btn ghost" id="findClear">Clear</button>` : `<span class="note">Ask for a topic across all your sets</span>`}</div>
      ${f.turns.length ? `<div class="convo" aria-live="polite">${f.turns.map((t, i) => t.role === "user"
          ? `<div class="bubble me${f.fresh && i >= last - 1 ? " reveal" : ""}">${esc(t.text)}</div>`
          : `<div class="bubble bot${f.fresh && i === last ? " reveal" : ""}">${esc(t.text || "Here they are.")}<span class="n">${t.ids.length} card${t.ids.length === 1 ? "" : "s"}</span></div>`).join("")}
        ${f.busy ? `<div class="bubble bot wait reveal">Looking through your cards <i></i><i></i><i></i></div>` : ""}</div>` : ""}
      ${f.error ? `<p class="status err reveal" style="margin:0">${esc(f.error)}</p>` : ""}
      ${f.results.length && !f.busy ? `<div class="stack reveal" style="gap:10px">
        ${count("grammar") && count("word") ? `<div class="modes" role="group" aria-label="Which of the found cards">${FILTERS.map(seg).join("")}</div>` : ""}
        <ul class="found${f.fresh ? " just" : ""}">${ofKind(f.results, f.kind).map(c => `<li><button data-fcard="${esc(c.id)}" aria-pressed="${!f.off.has(c.id)}">
            <span class="tick" aria-hidden="true">✓</span>
            <span class="jp" lang="ja">${esc(c.jp)}${c.reading ? `<small>${esc(c.reading)}</small>` : ""}<span class="meta${kindOf(c) === "grammar" ? " g" : ""}">${kindOf(c) === "grammar" ? "grammar · " : ""}${esc(c.set_name)}</span></span>
            <span class="en">${esc(c.en)}</span></button></li>`).join("")}</ul>
        <div class="row">
          <button class="btn primary" id="findGo" ${kept.length ? "" : "disabled"}>Practice</button>
          <span class="learnnote">${kept.length} card${kept.length === 1 ? "" : "s"}${f.off.size ? " · tap a card to put it back" : " · tap a card to leave it out"}</span>
        </div></div>` : ""}
      <form class="ask" id="findForm">
        <input id="findInput" value="${esc(f.draft)}" maxlength="500" autocomplete="off" aria-label="What cards do you want?"
          placeholder="${f.results.length ? "Refine: only verbs, add the months…" : "e.g. cards about days of the week"}" ${f.busy || down ? "disabled" : ""}>
        <button class="btn primary" type="submit" ${f.busy || down ? "disabled" : ""}>Ask</button>
      </form>
      ${down ? `<p class="note" style="margin:0">The local model (<span class="mono">${esc(store.helper || "qwen")}</span>) isn't running, so the finder is off. Practice below still works.</p>` : ""}
    </section>`;
  }

  async function askFinder(text) {
    const f = state.find;
    f.turns.push({ role: "user", text }); f.draft = ""; f.busy = true; f.error = ""; f.fresh = true;
    render();
    try {
      const out = await api("POST", "/api/find", { turns: f.turns.map(t => ({ role: t.role, text: t.text, ids: t.ids || [] })) });
      f.turns.push({ role: "assistant", text: out.reply, ids: out.cards.map(c => c.id) });
      f.results = out.cards; f.off = new Set(); f.kind = "all";
    } catch (e) {
      f.turns.pop(); f.draft = text;          // nothing came back: let them resend it
      f.error = e.message || "The finder didn't answer.";
    }
    f.busy = false; f.fresh = true;
    if (state.view === "library") { render(); $view.querySelector("#findInput")?.focus(); }
  }

  function bindFind() {
    const f = state.find, q = s => $view.querySelector(s);
    if (!q("#findPanel")) return;
    q("#findInput").oninput = e => { f.draft = e.target.value; };
    q("#findForm").onsubmit = e => { e.preventDefault(); const t = f.draft.trim(); if (t && !f.busy) askFinder(t); };
    q("#findClear")?.addEventListener("click", () => {
      state.find = { turns: [], results: [], kind: "all", off: new Set(), busy: false, error: "", draft: "", fresh: false };
      render();
    });
    $view.querySelectorAll("[data-fkind]").forEach(b => b.onclick = () => { f.kind = b.dataset.fkind; render(); });
    $view.querySelectorAll("[data-fcard]").forEach(b => b.onclick = () => {   // toggled in place: no redraw, no scroll jump
      const id = b.dataset.fcard;
      f.off.has(id) ? f.off.delete(id) : f.off.add(id);
      b.setAttribute("aria-pressed", !f.off.has(id));
      const kept = findKept().length;
      q("#findGo").disabled = !kept;
      q("#findGo").nextElementSibling.textContent = `${kept} card${kept === 1 ? "" : "s"} · tap a card to ${f.off.size ? "put it back" : "leave it out"}`;
    });
    q("#findGo")?.addEventListener("click", () => {
      const cards = findKept().map(c => ({ ...c, from: c.set_name }));
      if (!cards.length) return;
      const ask = [...f.turns].reverse().find(t => t.role === "user")?.text || "Found cards";
      state.mixSet = { id: "mix", virtual: true, found: true, name: ask.length > 28 ? ask.slice(0, 27) + "…" : ask, cards, progress: {} };
      state.setId = "mix";
      startStudy(state.mixSet, cards);
    });
  }

  function mixPanel() {
    if (!state.sets.length) return "";
    const pool = mixPool();
    const n = state.mixCount ? Math.min(state.mixCount, pool.length) : pool.length;
    const seg = (attr, cur, opts) => opts.map(([v, t]) => `<button data-${attr}="${v}" aria-pressed="${cur === v}">${t}</button>`).join("");
    const counts = k => state.sets.filter(s => !state.mixOff.has(s.id)).reduce((t, s) => t + ofKind(s.cards, k).length, 0);
    const on = state.sets.filter(s => !state.mixOff.has(s.id));
    const from = on.length === state.sets.length ? "all sets" : on.length ? on.map(s => s.name).join(", ") : "no sets";
    const summary = esc(`${FILTER_LABEL[state.mixKind]} · ${from} · ${state.mixCount || "all"} · ${DIR_LABEL[state.dir]}`);
    return `<section class="panel stack practice">
      <div class="row"><h3>Practice across sets</h3><span class="spacer"></span><span class="note">Random cards from the sets you pick</span></div>
      ${optionsBox("mix", summary, `<div class="mixgrid">
        <span class="learnnote">Cards</span>
        <div class="modes" role="group" aria-label="Which cards">${seg("mixkind", state.mixKind, [["all", `All <span class="mono">${counts("all")}</span>`], ["word", `Words <span class="mono">${counts("word")}</span>`], ["grammar", `Grammar <span class="mono">${counts("grammar")}</span>`]])}</div>
        <span class="learnnote">From</span>
        <div class="chips">${state.sets.map(s => `<button class="chip" data-mixset="${esc(s.id)}" aria-pressed="${!state.mixOff.has(s.id)}">${esc(s.name)}</button>`).join("")}</div>
        <span class="learnnote">How many</span>
        <div><select id="mixCount" aria-label="How many cards">${MIX_COUNTS.map(c => `<option value="${c}" ${state.mixCount === c ? "selected" : ""}>${c ? `${c} cards` : "All of them"}</option>`).join("")}</select></div>
        <span class="learnnote">Show first</span>
        <div class="modes" role="group" aria-label="Card direction">${seg("dir", state.dir, [["jp-en", "日本語 → EN"], ["en-jp", "EN → 日本語"], ["mix", "Mixed"]])}</div>
      </div>`)}
      <div class="row">
        <button class="btn primary" id="mixGo" ${n ? "" : "disabled"}>Start</button>
        <span class="learnnote">${n ? `${n} card${n === 1 ? "" : "s"}, shuffled` : "No cards match. Pick another set or type."}</span>
      </div>
    </section>`;
  }
  function bindMix() {
    $view.querySelectorAll("[data-mixkind]").forEach(b => b.onclick = () => { state.mixKind = b.dataset.mixkind; savePrefs(); render(); });
    $view.querySelectorAll("[data-mixset]").forEach(b => b.onclick = () => {
      const id = b.dataset.mixset;
      state.mixOff.has(id) ? state.mixOff.delete(id) : state.mixOff.add(id);
      savePrefs(); render();
    });
    $view.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => { state.dir = b.dataset.dir; savePrefs(); render(); });
    $view.querySelector("#mixCount")?.addEventListener("change", e => { state.mixCount = +e.target.value; savePrefs(); render(); });
    $view.querySelector("#mixGo")?.addEventListener("click", startMix);
  }

  function renderLibrary() {
    const sets = visibleSets().slice().sort((a, b) => (a.created || 0) - (b.created || 0));
    $view.innerHTML = `
      ${findPanel()}
      ${mixPanel()}
      <div class="row" style="${state.sets.length ? "margin-top:24px" : ""}"><span class="eyebrow">Your sets</span><span class="spacer"></span>
        ${store.model ? `<span class="note">Reading images with <span class="mono">${esc(store.model)}</span></span>` : ""}</div>
      <div class="sets">
        ${sets.map((s, i) => {
          const g = ofKind(s.cards, "grammar").length, w = s.cards.length - g;
          return `
          <button class="set" data-open="${esc(s.id)}" style="--i:${i}">
            <span class="ring" aria-hidden="true"></span>
            ${s.example ? `<span class="tag">example</span>` : ""}
            <h3>${esc(s.name)}</h3>
            <span class="count">${w} word${w === 1 ? "" : "s"}${g ? ` · <span class="g">${g} grammar</span>` : ""}${s.image_count ? ` · ${s.image_count} photo${s.image_count === 1 ? "" : "s"}` : ""}</span>
            <span class="peek">${esc(s.cards.slice(0, 4).map(c => c.jp).join("・")) || "&nbsp;"}</span>
          </button>`; }).join("")}
        <button class="set new" id="newBtn" style="--i:${sets.length}">+ New set</button>
      </div>
      <form class="newform" id="newForm" hidden>
        <input id="newName" placeholder="Set name, e.g. Vocab ${state.sets.length + 1}" aria-label="New set name">
        <button class="btn primary" type="submit">Create</button>
        <button class="btn ghost" type="button" id="newCancel">Cancel</button>
      </form>
      ${flashMsg ? `<p class="status err">${esc(flashMsg)}</p>` : ""}`;
    flashMsg = "";
    bindFind();
    bindMix();
    bindOptions();
    $view.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { state.setId = b.dataset.open; state.view = "set"; state.pending = null; render(); });
    const form = $view.querySelector("#newForm");
    $view.querySelector("#newBtn").onclick = () => { form.hidden = false; form.querySelector("input").focus(); };
    $view.querySelector("#newCancel").onclick = () => { form.hidden = true; };
    form.onsubmit = async e => {
      e.preventDefault();
      const name = form.querySelector("input").value.trim() || `Vocab ${state.sets.length + 1}`;
      try {
        const set = await store.create({ name, cards: [] });
        state.sets.push(set); state.setId = set.id; state.view = "set"; render();
      } catch (err) { flash("Couldn't create the set: " + err.message); }
    };
  }

  function renderSet() {
    const set = currentSet();
    if (!set) { state.view = "library"; return render(); }
    const p = state.pending;
    $view.innerHTML = `
      <div class="stack">
        <div class="row">
          <button class="btn ghost" id="back">← All sets</button>
          <span class="spacer"></span>
        </div>
        <div class="row">
          ${state.renaming
            ? `<form id="renameForm" class="row" style="flex:1 1 260px;gap:8px">
                 <input id="setName" value="${esc(set.name)}" aria-label="Set name" maxlength="100" style="font-size:20px;font-weight:700;flex:1 1 160px">
                 <button class="btn primary" type="submit">Save</button>
                 <button class="btn ghost" type="button" id="renameCancel">Cancel</button>
               </form>`
            : `<h2 class="setTitle">${esc(set.name)}</h2>
               <button class="btn" id="renameBtn" aria-label="Rename this set">Rename</button>`}
          ${set.example ? `<span class="note">Example set. Add or edit anything to keep it.</span>` : ""}
        </div>

        ${set.cards.length ? (() => {
          const k = filterFor(set), deck = ofKind(set.cards, k);
          const pr = progressSummary(set);
          const dirBtn = (v, t) => `<button data-dir="${v}" aria-pressed="${state.dir === v}">${t}</button>`;
          const kindBtn = v => `<button data-kf="${v}" aria-pressed="${k === v}">${FILTER_LABEL[v]} <span class="mono">${ofKind(set.cards, v).length}</span></button>`;
          const summary = esc([mixedKinds(set) ? FILTER_LABEL[k] : "", DIR_LABEL[state.dir], `${state.learnSize} at a time`].filter(Boolean).join(" · "));
          return `<section class="panel stack practice">
            <div class="row"><h3>Practice</h3></div>
            ${optionsBox("practice", summary, `<div class="mixgrid">
              ${mixedKinds(set) ? `<span class="learnnote">Cards</span>
              <div class="modes" role="group" aria-label="Which cards">${FILTERS.map(kindBtn).join("")}</div>` : ""}
              <span class="learnnote">Show first</span>
              <div class="modes" role="group" aria-label="Card direction">${dirBtn("jp-en", "日本語 → EN")}${dirBtn("en-jp", "EN → 日本語")}${dirBtn("mix", "Mixed")}</div>
              <label class="learnnote" for="learnSize">Smart learn</label>
              <div><select id="learnSize" aria-label="Cards in rotation at a time">${LEARN_SIZES.map(n => `<option value="${n}" ${state.learnSize === n ? "selected" : ""}>${n} cards at a time</option>`).join("")}</select></div>
            </div>`)}
            <div class="studybar">
              <button class="btn primary" id="smart">${pr.smart ? "Continue smart learn" : "Smart learn"}</button>
              <button class="btn" id="study">${pr.review ? `Continue review` : `Review all ${deck.length}`}</button>
            </div>
            ${pr.smart || pr.review ? `<div class="learnnote stack" style="gap:2px">
              ${pr.smart ? `<span>Smart learn: ${pr.cleared} of ${deck.length} cleared · <button class="linkbtn inline" id="resetSmart">Start over</button></span>` : ""}
              ${pr.review ? `<span>Review: ${pr.reviewed} of ${deck.length} done · <button class="linkbtn inline" id="resetReview">Start over</button></span>` : ""}
            </div>` : ""}
          </section>`;
        })() : ""}

        <section class="panel">
          ${optionsBox("instr", state.instr?.trim() ? esc(state.instr.trim()) : "every vocabulary word", `<div class="instr">
            <label for="instr">What should the cards cover? <span class="muted">(optional)</span></label>
            <textarea id="instr" rows="2" maxlength="1000" placeholder="e.g. Make cards for the particles に, を and へ, with an example sentence for each">${esc(state.instr || "")}</textarea>
            <span class="hint">Leave empty to pull out every vocabulary word. Write a request to make grammar cards or anything else from the page.</span>
          </div>`, "Instructions")}
          <div class="drop" id="drop">
            <strong>Add a page</strong>
            <span class="muted">Drop images here, paste a screenshot, or choose them. Add as many as you need, then tap Make cards.</span>
            <div class="row" style="justify-content:center;margin-top:10px">
              <label class="btn" for="file">${(state.staged[set.id] || []).length ? "Add more images" : "Choose images"}</label>
              <input type="file" id="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden>
            </div>
            <div class="thumbs" id="thumbs">${(state.staged[set.id] || []).map((f, i) => `
              <span class="thumb"><img alt="${esc(f.name)}" src="${thumbUrl(f)}"><button class="thumbx" data-unstage="${i}" aria-label="Remove this photo">×</button></span>`).join("")}</div>
          </div>
          ${(state.images[set.id]?.length ?? set.image_count) ? `<p class="learnnote" id="useHint" style="margin:10px 0 0">You can also tap <b>Use</b> on photos already in this set, below.</p>` : ""}
          ${(() => {
            const n = (state.staged[set.id] || []).length + (state.selImgs[set.id]?.size || 0);
            const staged = (state.staged[set.id] || []).length;
            const what = (staged ? `${staged} new photo${staged === 1 ? "" : "s"}` : "") + (state.selImgs[set.id]?.size ? `${(state.staged[set.id] || []).length ? " + " : ""}${state.selImgs[set.id].size} saved page${state.selImgs[set.id].size === 1 ? "" : "s"}` : "");
            return `<div class="row makebar">
              <span class="learnnote">${n > MAX_PAGES ? `That's ${n} pages. Use ${MAX_PAGES} or fewer at a time.` : n ? `Ready: ${what}` : "Nothing added yet"}</span>
              <span class="spacer"></span>
              ${staged ? `<button class="btn ghost" id="clearStaged">Clear</button>` : ""}
              <button class="btn primary" id="makeCards" ${n && n <= MAX_PAGES ? "" : "disabled"}>Make cards</button>
            </div>`;
          })()}
          <p class="status" id="status"></p>
        </section>

        ${p ? `
        <section class="panel review stack${pendingFresh ? " just" : ""}">
          <div class="row"><h3>${p.length ? `Found ${p.length} card${p.length === 1 ? "" : "s"}` : "All removed"}</h3><span class="spacer"></span><span class="note">Fix anything, check each is a word or grammar, remove what you don't want</span></div>
          <ol class="pcards">${p.map((c, i) => `
            <li class="pcard" style="--i:${Math.min(i, 12)}">
              <div class="pcard-head"><span class="mono muted">${i + 1}</span>
                <span class="kindseg" role="group" aria-label="Card ${i + 1} type"><button data-pk="word" data-pki="${i}" aria-pressed="${kindOf(c) === "word"}">Word</button><button data-pk="grammar" data-pki="${i}" aria-pressed="${kindOf(c) === "grammar"}">Grammar</button></span>
                <button class="btn remove" data-pdel="${i}" aria-label="Remove card ${i + 1}">Remove</button></div>
              <div class="pcard-row">
                <label>Japanese<input class="jpin" data-p="${i}" data-k="jp" value="${esc(c.jp)}"></label>
                <label>Reading<input class="jpin" data-p="${i}" data-k="reading" value="${esc(c.reading)}"></label>
              </div>
              <label>English<textarea data-p="${i}" data-k="en" rows="${c.en.length > 80 ? 3 : c.en.length > 35 ? 2 : 1}">${esc(c.en)}</textarea></label>
            </li>`).join("")}
          </ol>
          <div class="confirm">
            <button class="btn primary" id="addPending" ${p.length ? "" : "disabled"}>Add ${p.length} to ${esc(set.name)}</button>
            <button class="btn ghost" id="discard">Discard all</button>
          </div>
        </section>` : ""}

        <section class="panel stack">
          <div class="row"><h3>Cards</h3><span class="spacer"></span><span class="mono muted">${set.cards.length}</span></div>
          <p class="learnnote" style="margin:0">Tap a card's <span class="kind">word</span> or <span class="kind grammar">grammar</span> tag to move it to the other group.</p>
          ${[["grammar", "Grammar", "particles, conjugations and patterns"], ["word", "Words", "vocabulary to memorize"]].map(([k, title, sub]) => {
            const cards = ofKind(set.cards, k);
            return `<div class="group-head"><h4>${title}</h4><span class="sub">${sub}</span><span class="spacer"></span><span class="mono muted">${cards.length}</span></div>
          <div class="tablewrap"><table>
            <thead><tr><th>Japanese</th><th>Reading</th><th>English</th><th></th></tr></thead>
            <tbody>
              ${cards.map((c, i) => `<tr${state.moved === c.id ? ' class="moved"' : ""} style="--i:${Math.min(i, 12)}"><td class="jp">${esc(c.jp)}</td><td class="rd">${esc(c.reading)}</td><td>${esc(c.en)}</td>
                <td class="acts"><button class="kind${k === "grammar" ? " grammar" : ""}" data-flip="${esc(c.id)}" aria-label="Move to ${k === "grammar" ? "words" : "grammar"}" title="Move to ${k === "grammar" ? "Words" : "Grammar"}">${k}</button>${c.image_id ? `<a class="src" href="/api/images/${esc(c.image_id)}" target="_blank" rel="noopener" title="Open the photo this card came from"><img alt="Source photo" loading="lazy" src="/api/images/${esc(c.image_id)}"></a>` : ""}<button class="x" data-del="${esc(c.id)}" aria-label="Delete card">×</button></td></tr>`).join("")
                || `<tr><td colspan="4" class="muted">${k === "grammar" ? "No grammar cards yet." : "No words yet."} Add a photo above or type one below.</td></tr>`}
              <tr data-addrow="${k}">
                <td class="jp"><input data-m="jp" size="4" placeholder="${k === "grammar" ? "〜ます" : "日本語"}" aria-label="Japanese"></td>
                <td class="rd"><input data-m="reading" size="4" placeholder="よみ" aria-label="Reading"></td>
                <td><input data-m="en" size="6" placeholder="${k === "grammar" ? "What the rule does" : "English"}" aria-label="English"></td>
                <td><button class="btn" data-madd="${k}">Add</button></td>
              </tr>
            </tbody></table></div>`;
          }).join("")}
        </section>

        ${set.example ? "" : `
        <section class="panel stack">
          <div class="row"><h3>Photos</h3><span class="spacer"></span><span class="mono muted" id="photoCount"></span></div>
          <div class="photos" id="photoGrid"><span class="muted">Loading photos…</span></div>
        </section>`}

        <div class="row">
          <span class="spacer"></span>
          <button class="btn ghost" id="delSet">Delete set</button>
          <span id="delConfirm" hidden class="row"><span class="note">Delete “${esc(set.name)}” with its cards and photos?</span>
            <button class="btn" id="delYes" style="color:var(--again);border-color:var(--again)">Delete</button>
            <button class="btn ghost" id="delNo">Keep</button></span>
        </div>
      </div>`;

    const q = s => $view.querySelector(s);
    bindOptions();
    if (!set.example) loadPhotos(set);
    q("#back").onclick = () => {
      state.renaming = false;
      state.view = "library"; state.pending = null; render();
      progressChain.then(() => store.list()).then(sets => { state.sets = sets; if (state.view === "library") render(); }).catch(() => {});
    };
    q("#study")?.addEventListener("click", () => startStudy(set));
    q("#smart")?.addEventListener("click", () => startSmart(set));
    $view.querySelectorAll("[data-dir]").forEach(b => b.onclick = () => { state.dir = b.dataset.dir; savePrefs(); render(); });
    q("#learnSize")?.addEventListener("change", e => { state.learnSize = +e.target.value; savePrefs(); });
    q("#resetSmart")?.addEventListener("click", () => { putProgress(set, pkey("smart", filterFor(set)), null); render(); });
    q("#resetReview")?.addEventListener("click", () => { putProgress(set, pkey("review", filterFor(set)), null); render(); });
    $view.querySelectorAll("[data-kf]").forEach(b => b.onclick = () => { state.kindFilter = b.dataset.kf; savePrefs(); render(); });
    q("#renameBtn")?.addEventListener("click", () => {
      state.renaming = true; render();
      const i = $view.querySelector("#setName"); i.focus(); i.select();
    });
    q("#renameCancel")?.addEventListener("click", () => { state.renaming = false; render(); });
    q("#setName")?.addEventListener("keydown", e => { if (e.key === "Escape") { state.renaming = false; render(); } });
    q("#renameForm")?.addEventListener("submit", async e => {
      e.preventDefault();
      const v = q("#setName").value.trim();
      state.renaming = false;
      if (v && v !== set.name) { set.name = v; await persist(set); }
      render();
    });

    // image input
    q("#instr").oninput = e => {
      state.instr = e.target.value;
      q('[data-opts="instr"] .opts-sum').textContent = state.instr.trim() || "every vocabulary word";
    };
    const drop = q("#drop");
    q("#file").onchange = e => { stage([...e.target.files]); e.target.value = ""; };
    $view.querySelectorAll("[data-unstage]").forEach(b => b.onclick = () => { state.staged[set.id].splice(+b.dataset.unstage, 1); render(); });
    q("#clearStaged")?.addEventListener("click", () => { state.staged[set.id] = []; render(); });
    q("#makeCards")?.addEventListener("click", e => {
      e.currentTarget.disabled = true;
      handleImages([...(state.staged[set.id] || [])], [...(state.selImgs[set.id] || [])]);
    });
    drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
    drop.ondragleave = () => drop.classList.remove("over");
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); stage([...e.dataTransfer.files].filter(f => f.type.startsWith("image/"))); };

    // pending review
    if (p) {
      $view.querySelectorAll("[data-p]").forEach(inp => inp.oninput = () => { p[+inp.dataset.p][inp.dataset.k] = inp.value; });
      $view.querySelectorAll("[data-pdel]").forEach(b => b.onclick = () => { p.splice(+b.dataset.pdel, 1); render(); });
      $view.querySelectorAll("[data-pk]").forEach(b => b.onclick = () => {   // toggled in place so typed edits aren't redrawn away
        p[+b.dataset.pki].kind = b.dataset.pk;
        b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
      });
      q("#addPending").onclick = async () => {
        const clean = p.filter(c => c.jp.trim() || c.en.trim()).map(c => ({ id: uid(), jp: c.jp.trim(), reading: c.reading.trim(), en: c.en.trim(), kind: kindOf(c), ...(c.image_id ? { image_id: c.image_id } : {}) }));
        set.cards.push(...clean); state.pending = null;
        await persist(set); render();
      };
      q("#discard").onclick = () => { state.pending = null; render(); };
    }

    // manual add (each group's row adds that kind), move between groups, delete
    $view.querySelectorAll("[data-addrow]").forEach(row => {
      const kind = row.dataset.addrow;
      const val = k => row.querySelector(`[data-m="${k}"]`).value.trim();
      const add = async () => {
        const jp = val("jp"), reading = val("reading"), en = val("en");
        if (!jp && !en) return;
        const card = { id: uid(), jp, reading, en, kind };
        set.cards.push(card); state.moved = card.id;
        await persist(set); render();
        $view.querySelector(`[data-addrow="${kind}"] [data-m="jp"]`)?.focus();
      };
      row.querySelector("[data-madd]").onclick = add;
      row.querySelectorAll("input").forEach(i => i.onkeydown = e => { if (e.key === "Enter") add(); });
    });
    $view.querySelectorAll("[data-flip]").forEach(b => b.onclick = async () => {
      const card = set.cards.find(c => c.id === b.dataset.flip); if (!card) return;
      card.kind = kindOf(card) === "grammar" ? "word" : "grammar";
      state.moved = card.id; render();
      await persist(set);
    });
    $view.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      set.cards = set.cards.filter(c => c.id !== b.dataset.del); await persist(set); render();
    });

    q("#delSet").onclick = () => { q("#delSet").hidden = true; q("#delConfirm").hidden = false; };
    q("#delNo").onclick = () => { q("#delSet").hidden = false; q("#delConfirm").hidden = true; };
    q("#delYes").onclick = async () => {
      if (!set.example) {
        try { await store.remove(set.id); } catch (err) { return flash("Couldn't delete: " + err.message); }
        state.sets = state.sets.filter(s => s.id !== set.id);
      }
      state.view = "library"; render();
    };
  }

  // ---------- reading images (server: /api/extract, ADK agent via LiteLLM) ----------
  const PER_REQUEST = 4;
  const MAX_SIDE = 2000;

  // Shrink big phone photos before upload: faster, cheaper, and plenty for reading text.
  async function prepare(file) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      if (scale === 1 && file.size < 4e6) return file;
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.9));
      return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
    } catch { return file; }
  }

  // New photos (`files`) are saved to the set; `savedIds` reuse photos it already has.
  // With instructions, every page goes in one request so the model sees them together.

  // ---------- staging: photos wait here until "Make cards" sends them ----------
  const MAX_PAGES = 12;
  const thumbUrls = new WeakMap();
  const thumbUrl = f => { if (!thumbUrls.has(f)) thumbUrls.set(f, URL.createObjectURL(f)); return thumbUrls.get(f); };
  function stage(files) {
    const set = currentSet(); if (!set || !files.length) return;
    const list = state.staged[set.id] ??= [];
    list.push(...files);
    render();
  }

  async function handleImages(files, savedIds = []) {
    const status = $view.querySelector("#status");
    const thumbs = $view.querySelector("#thumbs");
    if (!files.length && !savedIds.length) return;
    status.className = "status";
    const set = currentSet();
    if (set.example) { await persist(set); if (set.example) return; }   // photos need a saved set
    const instr = (state.instr || "").trim();
    const found = [], problems = [];
    const batches = [];
    if (instr) batches.push({ files, ids: savedIds });
    else {
      for (let i = 0; i < files.length; i += PER_REQUEST) batches.push({ files: files.slice(i, i + PER_REQUEST), ids: [] });
      for (let i = 0; i < savedIds.length; i += PER_REQUEST) batches.push({ files: [], ids: savedIds.slice(i, i + PER_REQUEST) });
    }
    const pages = files.length + savedIds.length;
    try {
      for (const [n, batch] of batches.entries()) {
        status.textContent = instr
          ? `Making cards from your instructions with ${pages === 1 ? "this page" : pages + " pages"}… this can take up to a minute.`
          : batches.length > 1
            ? `Reading batch ${n + 1} of ${batches.length}…`
            : `Reading ${pages === 1 ? "the image" : pages + " images"}… this can take up to a minute.`;
        const form = new FormData();
        form.append("set_id", set.id);
        if (instr) form.append("instructions", instr);
        if (batch.ids.length) form.append("image_ids", batch.ids.join(","));
        for (const f of await Promise.all(batch.files.map(prepare))) form.append("files", f, f.name);
        const out = await api("POST", "/api/extract", form);
        found.push(...(out.cards || []));
        problems.push(...(out.errors || []));
      }
      state.selImgs[set.id] = new Set();
      state.staged[set.id] = [];      // sent and saved to the set
    } catch (e) {
      problems.push({ error: e?.message || "the server didn't respond" });
    }
    delete state.images[set.id];      // photos were saved; reload the gallery
    const note = problems.length
      ? (instr ? `Couldn't make the cards: ${problems[0].error}`
        : `Couldn't read ${problems.length === 1 ? "one photo" : problems.length + " photos"}: ${problems[0].error} The photos are saved below.`)
      : "";
    if (!found.length) {
      render();
      const s = $view.querySelector("#status");
      s.className = "status err";
      s.textContent = note || (instr
        ? "No cards came back for that request. Try rewording it, or check the page covers it."
        : "No Japanese words found in that image. Try a clearer or closer photo. The photo is saved below.");
      return;
    }
    state.pending = (state.pending || []).concat(found);
    pendingFresh = true;
    render();
    if (note) { const s = $view.querySelector("#status"); s.className = "status err"; s.textContent = note; }
  }

  // ---------- photo gallery ----------
  async function loadPhotos(set) {
    const grid = $view.querySelector("#photoGrid");
    if (!grid) return;
    try {
      state.images[set.id] ??= await api("GET", `/api/sets/${encodeURIComponent(set.id)}/images`);
    } catch (e) { grid.innerHTML = `<span class="status err">Couldn't load photos: ${esc(e.message)}</span>`; return; }
    if (state.view !== "set" || state.setId !== set.id) return;
    const imgs = state.images[set.id];
    $view.querySelector("#photoCount").textContent = imgs.length || "";
    if (!imgs.length) { grid.innerHTML = `<span class="muted">Photos you add are kept here.</span>`; return; }
    const sel = state.selImgs[set.id] ??= new Set();
    const hadPicker = !!$view.querySelector("#useHint");
    const used = new Map();
    set.cards.forEach(c => c.image_id && used.set(c.image_id, (used.get(c.image_id) || 0) + 1));
    grid.innerHTML = imgs.map(im => `
      <figure class="photo${sel.has(im.id) ? " picked" : ""}">
        <a href="${esc(im.url)}" target="_blank" rel="noopener"><img alt="${esc(im.filename)}" loading="lazy" src="${esc(im.url)}"></a>
        <figcaption><button class="usebtn" data-use="${esc(im.id)}" aria-pressed="${sel.has(im.id)}">${sel.has(im.id) ? "✓ Using" : "Use"}</button><span>${used.get(im.id) || 0} cards</span>
          <button class="x" data-imgdel="${esc(im.id)}" aria-label="Delete photo">×</button>
          <span class="row" data-imgconfirm="${esc(im.id)}" hidden style="gap:4px">
            <button class="linkbtn danger" data-imgyes="${esc(im.id)}">Delete</button>
            <button class="linkbtn" data-imgno="${esc(im.id)}">Keep</button></span>
        </figcaption>
      </figure>`).join("");
    if (!hadPicker) { render(); return; }   // the "use saved pages" row needs the photo list
    grid.querySelectorAll("[data-use]").forEach(b => b.onclick = () => {
      const id = b.dataset.use;
      sel.has(id) ? sel.delete(id) : sel.add(id);
      render();
    });
    grid.querySelectorAll("[data-imgdel]").forEach(b => b.onclick = () => {
      b.hidden = true; grid.querySelector(`[data-imgconfirm="${b.dataset.imgdel}"]`).hidden = false;
    });
    grid.querySelectorAll("[data-imgno]").forEach(b => b.onclick = () => {
      grid.querySelector(`[data-imgconfirm="${b.dataset.imgno}"]`).hidden = true;
      grid.querySelector(`[data-imgdel="${b.dataset.imgno}"]`).hidden = false;
    });
    grid.querySelectorAll("[data-imgyes]").forEach(b => b.onclick = async () => {
      try { await api("DELETE", `/api/images/${encodeURIComponent(b.dataset.imgyes)}`); }
      catch (e) { return flash("Couldn't delete the photo: " + e.message); }
      state.images[set.id] = imgs.filter(im => im.id !== b.dataset.imgyes);
      sel.delete(b.dataset.imgyes);
      render();
    });
  }
  document.addEventListener("paste", e => {
    if (state.view !== "set") return;
    const imgs = [...(e.clipboardData?.files || [])].filter(f => f.type.startsWith("image/"));
    if (imgs.length) { e.preventDefault(); stage(imgs); }
  });

  // ---------- study ----------
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // Progress lives on the server with the set, so it follows you between devices.
  // Saves run one after another so a slow request can't overwrite a newer one.
  let progressChain = Promise.resolve();
  function getProgress(set, mode) { return set.progress?.[mode] || null; }
  function putProgress(set, mode, data) {
    const next = { ...(set.progress || {}) };
    if (data) next[mode] = data; else delete next[mode];
    set.progress = next;
    if (set.example || set.virtual) return;   // the example set and mixed rounds aren't saved anywhere
    const id = set.id, body = next;
    progressChain = progressChain.then(() => api("PUT", `/api/sets/${encodeURIComponent(id)}/progress`, body)).catch(() => {});
  }

  // Practice in a set can be limited to words or grammar. Each choice keeps its own place
  // ("smart", "smart:grammar", ...), so switching doesn't wipe the others.
  const mixedKinds = set => { const g = ofKind(set.cards, "grammar").length; return g > 0 && g < set.cards.length; };
  const filterFor = set => set.virtual || !mixedKinds(set) ? "all" : state.kindFilter;
  const pkey = (mode, k) => k === "all" ? mode : `${mode}:${k}`;

  // ---------- Review all: one pass through every card, resumable ----------
  // Stopping partway saves the order and position; finishing the set clears it, so the
  // next session starts again from the beginning.
  function startStudy(set, cards) {
    if (cards) {                        // "Review missed" after a round: a quick extra pass, not saved
      const deck = shuffle(cards).map(c => ({ ...c, side: pickSide() }));
      state.study = { mode: "review", setId: set.id, persist: false, queue: deck, done: [], total: deck.length, known: 0, missed: new Map(), flipped: false };
      state.view = "study"; return render();
    }
    const key = pkey("review", filterFor(set));
    const pool = ofKind(set.cards, filterFor(set));
    const byId = new Map(pool.map(c => [c.id, c]));
    const saved = getProgress(set, key);
    let queueIds = [], done = [], known = 0, missedIds = [];
    if (saved?.queue?.length) {
      queueIds = saved.queue.filter(id => byId.has(id));
      done = (saved.done || []).filter(id => byId.has(id));
      known = Math.min(saved.known || 0, done.length);
      missedIds = (saved.missed || []).filter(id => byId.has(id));
    }
    const placed = new Set([...queueIds, ...done]);
    const fresh = shuffle(pool.filter(c => !placed.has(c.id))).map(c => c.id);   // first run, or cards added since
    const queue = [...queueIds, ...fresh].map(id => ({ ...byId.get(id), side: pickSide() }));
    const s = {
      mode: "review", setId: set.id, persist: true, key, queue, done, known, flipped: false,
      total: done.length + queue.length,
      missed: new Map(missedIds.map(id => [id, byId.get(id)])),
    };
    state.study = s;                    // saved after the first card is answered
    state.view = "study"; render();
  }
  function saveReview(s, set = currentSet()) {
    if (!s.persist || !set) return;
    putProgress(set, s.key, s.queue.length
      ? { queue: s.queue.map(c => c.id), done: s.done, known: s.known, missed: [...s.missed.keys()] }
      : null);                          // finished: next time starts from the beginning
  }

  // ---------- Smart learn: New -> Learning (a small rotation) -> Cleared ----------
  // Resumes where you stopped; clearing every card resets it for the next session.
  function progressSummary(set) {
    const k = filterFor(set);
    const ids = new Set(ofKind(set.cards, k).map(c => c.id));
    const smart = getProgress(set, pkey("smart", k)), review = getProgress(set, pkey("review", k));
    return {
      smart: !!smart,
      cleared: (smart?.cleared || []).filter(id => ids.has(id)).length,
      review: !!review,
      reviewed: (review?.done || []).filter(id => ids.has(id)).length,
    };
  }
  function saveSmart(s, set = currentSet()) {
    if (!set) return;
    putProgress(set, s.key, s.queue.length || s.unseen.length
      ? { cleared: s.cleared, learning: s.queue.map(c => c.id) }
      : null);                          // all cleared: next time starts from the beginning
  }
  function startSmart(set) {
    const key = pkey("smart", filterFor(set));
    const pool = ofKind(set.cards, filterFor(set));
    const byId = new Map(pool.map(c => [c.id, c]));
    const saved = getProgress(set, key) || {};
    const cleared = (saved.cleared || []).filter(id => byId.has(id));
    const done = new Set(cleared);
    const learningIds = (saved.learning || []).filter(id => byId.has(id) && !done.has(id));
    learningIds.forEach(id => done.add(id));
    const s = {
      mode: "smart", setId: set.id, key, flipped: false, size: state.learnSize,
      cleared, total: pool.length,
      queue: learningIds.map(id => ({ ...byId.get(id), side: pickSide() })),
      unseen: shuffle(pool.filter(c => !done.has(c.id))),
    };
    topUp(s);
    state.study = s;                    // saved after the first card is answered
    state.view = "study"; render();
  }
  function topUp(s) {   // keep the rotation at its size while new cards remain
    while (s.queue.length < s.size && s.unseen.length) s.queue.push({ ...s.unseen.shift(), side: pickSide() });
  }
  function gradeSmart(s, ok) {
    const card = s.queue.shift(); if (!card) return;
    if (ok) { s.cleared.push(card.id); topUp(s); }
    else { card.side = pickSide(); s.queue.push(card); }   // back of the rotation: everything else comes up first
    saveSmart(s);
  }

  function pickSide() { return state.dir === "mix" ? (Math.random() < .5 ? "jp-en" : "en-jp") : state.dir; }

  const lenClass = t => { const n = (t || "").length; return n > 160 ? " xlong" : n > 50 ? " long" : ""; };
  function faceHTML(c, which, dir) {
    const jpFirst = dir === "jp-en";
    const showJp = (which === "front") === jpFirst;
    const label = showJp ? "日本語" : "English";
    const hint = which === "front" ? `<span class="hint">Tap to flip</span>` : "";
    const body = showJp
      ? `<div class="big-jp" lang="ja">${esc(c.jp)}</div>${c.reading && (state.showReading || which === "back") ? `<div class="reading" lang="ja">${esc(c.reading)}</div>` : ""}${which === "back" ? `<div class="sub${lenClass(c.en)}">${esc(c.en)}</div>` : ""}`
      : `<div class="big-en${lenClass(c.en)}">${esc(c.en)}</div>${which === "back" ? `<div class="sub jp" lang="ja">${esc(c.jp)}${c.reading ? `（${esc(c.reading)}）` : ""}</div>` : ""}`;
    const tag = kindOf(c) === "grammar" ? `<span class="kindtag">文法 grammar</span>` : "";
    const from = c.from && which === "back" ? `<span class="fromset">${esc(c.from)}</span>` : "";
    return `<span class="hole" aria-hidden="true"></span>${tag}<span class="side">${label}</span>${body}${hint}${from}`;
  }

  function renderStudy() {
    const s = state.study, set = currentSet();
    if (!s || !set) { state.view = "library"; return render(); }
    const card = s.queue[0];
    const done = s.total - s.queue.length;
    const head = `
      <div class="stack">
        <div class="row">
          <button class="btn ghost" id="back">← ${set.virtual ? "All sets" : esc(set.name)}</button>
          <span class="spacer"></span>
          ${set.virtual ? `<span class="learnnote">${esc(set.name)} ·</span>` : ""}
          <span class="learnnote">${{ "jp-en": "日本語 → EN", "en-jp": "EN → 日本語", mix: "Mixed" }[state.dir]}</span>
        </div>
        <div class="row">${s.mode === "smart"
            ? `<span class="piles" aria-label="Card piles">
                 <span><i class="dot new"></i>New <b>${s.unseen.length}</b></span>
                 <span><i class="dot learning"></i>Learning <b>${s.queue.length}</b></span>
                 <span><i class="dot cleared"></i>Cleared <b>${s.cleared.length}</b></span></span>`
            : `<span class="mono muted">${done} / ${s.total}</span>`}<span class="spacer"></span>
          <label class="note row" style="gap:6px"><input type="checkbox" id="rd" ${state.showReading ? "checked" : ""} style="padding:0"> Show reading on front</label></div>
        ${s.mode === "smart"
          ? `<div class="progress split"><i style="width:${(s.cleared.length / s.total) * 100}%"></i><i class="learning" style="width:${(s.queue.length / s.total) * 100}%"></i></div>`
          : `<div class="progress"><i style="width:${(done / s.total) * 100}%"></i></div>`}`;

    if (!card && s.mode === "smart") {
      $view.innerHTML = head + `
        <div class="done panel">
          <div class="eyebrow">Set cleared</div>
          <div class="score">${s.cleared.length} / ${s.total}</div>
          <p class="muted">Every card in ${esc(set.name)} is cleared.</p>
          <div class="row" style="justify-content:center;margin-top:16px">
            <button class="btn primary" id="restartSmart">Start over</button>
            <button class="btn" id="reviewAll">Review all</button>
          </div>
        </div></div>`;
      bindStudyHead(set);
      $view.querySelector("#restartSmart").onclick = () => startSmart(set);   // progress was reset when the last card cleared
      $view.querySelector("#reviewAll").onclick = () => startStudy(set);
      return;
    }
    if (!card) {
      const missed = [...s.missed.values()];
      $view.innerHTML = head + `
        <div class="done panel">
          <div class="eyebrow">Round finished</div>
          <div class="score">${s.known} / ${s.total}</div>
          <p class="muted">known on the first try${missed.length ? ` · ${missed.length} to review` : ". Perfect round."}</p>
          <div class="row" style="justify-content:center;margin-top:16px">
            ${missed.length ? `<button class="btn primary" id="again">Review ${missed.length} missed</button>` : ""}
            <button class="btn${missed.length ? "" : " primary"}" id="restart">${set.found ? "Again" : set.virtual ? "New mix" : "Study all again"}</button>
          </div>
        </div></div>`;
      bindStudyHead(set);
      $view.querySelector("#again")?.addEventListener("click", () => startStudy(set, missed));
      $view.querySelector("#restart").onclick = () => set.found ? startStudy(set, set.cards) : set.virtual ? startMix() : startStudy(set);
      return;
    }

    $view.innerHTML = head + `
        <div class="scene${(card.en || "").length > 140 ? " tall" : ""}${dealt(s) ? " deal" : ""}">
          <div class="swipe" id="swipe">
            <span class="stamp good" aria-hidden="true">Got it</span>
            <span class="stamp again" aria-hidden="true">Again</span>
            <div class="card${s.flipped ? " flipped" : ""}" id="card" role="button" tabindex="0" aria-label="Flashcard. Press to flip, swipe right if you know it, left to see it again">
              <div class="face front">${faceHTML(card, "front", card.side)}</div>
              <div class="face back">${faceHTML(card, "back", card.side)}</div>
            </div>
          </div>
        </div>
        <div class="grade" id="grade" ${s.flipped ? "" : 'style="visibility:hidden"'}>
          <button class="btn again" id="gAgain">Again</button>
          <button class="btn good" id="gGood">Got it</button>
        </div>
        <div class="keys">Swipe → got it · ← again · tap to flip<br><kbd>Space</kbd> flip · <kbd>←</kbd> again · <kbd>→</kbd> got it</div>
      </div>`;
    bindStudyHead(set);
    const cardEl = $view.querySelector("#card");
    cardEl.onclick = () => { if (!swiped) flip(); };
    cardEl.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); flip(); } };
    $view.querySelector("#gAgain").onclick = () => throwCard(false);
    $view.querySelector("#gGood").onclick = () => throwCard(true);
    bindSwipe($view.querySelector("#swipe"));
  }

  function bindStudyHead(set) {
    $view.querySelector("#back").onclick = () => {
      state.study = null;
      if (set.virtual) { state.view = "library"; state.setId = null; state.mixSet = null; }
      else state.view = "set";
      render();
    };
    $view.querySelector("#rd").onchange = e => { state.showReading = e.target.checked; savePrefs(); render(); };
  }

  function flip() {
    const s = state.study; if (!s?.queue[0]) return;
    s.flipped = !s.flipped;
    $view.querySelector("#card").classList.toggle("flipped", s.flipped);
    $view.querySelector("#grade").style.visibility = s.flipped ? "" : "hidden";
  }
  // A new card slides in after each answer; flipping redraws the same card and doesn't.
  let lastDeal = null;
  function dealt(s) { const key = `${s.mode}:${s.deals || 0}`; const d = key !== lastDeal; lastDeal = key; return d; }
  function grade(ok) {
    const s = state.study;
    s.deals = (s.deals || 0) + 1;
    if (s.mode === "smart") { gradeSmart(s, ok); s.flipped = false; return render(); }
    const card = s.queue.shift(); if (!card) return;
    if (ok) { if (!s.missed.has(card.id)) s.known++; }
    else { s.missed.set(card.id, card); s.queue.splice(Math.min(s.queue.length, 3), 0, card); } // comes back a few cards later
    if (ok) s.done.push(card.id);
    saveReview(s);
    s.flipped = false;
    render();
  }
  document.addEventListener("keydown", e => {
    if (state.view !== "study" || e.target.matches?.("input, select, textarea")) return;
    if (e.key === " ") { e.preventDefault(); flip(); }
    else if (e.key === "ArrowRight") throwCard(true);
    else if (e.key === "ArrowLeft") throwCard(false);
  });

  // While studying, nothing on the page scrolls; the card's own handlers see the swipe first.
  document.addEventListener("touchmove", e => { if (state.view === "study") e.preventDefault(); }, { passive: false });

  // ---------- swiping: right = got it (out of this round), left = again (back into rotation) ----------
  let swiped = false, throwing = false;

  function setDrag(el, dx) {
    el.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    const k = Math.min(1, Math.abs(dx) / 90);
    el.querySelector(".stamp.good").style.opacity = dx > 0 ? k : 0;
    el.querySelector(".stamp.again").style.opacity = dx < 0 ? k : 0;
  }

  function throwCard(ok) {
    const el = $view.querySelector("#swipe");
    if (!el || throwing || !state.study?.queue[0]) return;
    if (reduceMotion()) return grade(ok);
    throwing = true;
    const dist = (ok ? 1 : -1) * (innerWidth + el.offsetWidth);
    el.classList.remove("back");
    el.querySelector(ok ? ".stamp.good" : ".stamp.again").style.opacity = 1;
    el.classList.add("fly");
    el.style.transform = `translateX(${dist}px) rotate(${dist / 30}deg)`;
    let done = false;
    const finish = () => { if (done) return; done = true; throwing = false; grade(ok); };
    el.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, 400);          // in case transitionend doesn't fire
  }

  // Touch events drive phones (iOS Safari cancels pointer events once it starts a scroll or
  // back-swipe); pointer events drive the mouse and pens.
  function bindSwipe(el) {
    let start = null, dx = 0, dragging = false;
    swiped = false;

    const down = (x, y) => {
      if (throwing) return;
      start = { x, y, t: performance.now() };
      dx = 0; dragging = false; swiped = false;
      el.classList.remove("back");
    };
    // returns true once this gesture is a horizontal drag we own
    const move = (x, y) => {
      if (!start) return false;
      const mx = x - start.x, my = y - start.y;
      if (!dragging) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return false;
        if (Math.abs(my) > Math.abs(mx)) { start = null; return false; }   // vertical: let the page scroll
        dragging = true; swiped = true;
      }
      dx = mx; setDrag(el, dx);
      return true;
    };
    const up = () => {
      if (!start) return;
      const speed = Math.abs(dx) / Math.max(1, performance.now() - start.t);   // px per ms
      start = null;
      if (!dragging) return;
      if (Math.abs(dx) > Math.min(110, el.offsetWidth * 0.3) || (speed > 0.6 && Math.abs(dx) > 30)) {
        throwCard(dx > 0);
      } else {
        el.classList.add("back"); setDrag(el, 0);
      }
      setTimeout(() => { swiped = false; }, 50);   // ignore the click that follows a drag
    };

    el.addEventListener("touchstart", e => {
      if (e.touches.length !== 1) { start = null; return; }
      down(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    el.addEventListener("touchmove", e => {
      if (e.touches.length !== 1) return;
      if (move(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();   // keep the page still
    }, { passive: false });
    el.addEventListener("touchend", up);
    el.addEventListener("touchcancel", up);

    el.addEventListener("pointerdown", e => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      down(e.clientX, e.clientY);
    });
    el.addEventListener("pointermove", e => {
      if (e.pointerType === "touch") return;
      if (move(e.clientX, e.clientY)) el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener("pointerup", e => { if (e.pointerType !== "touch") up(); });
    el.addEventListener("pointercancel", e => { if (e.pointerType !== "touch") up(); });
  }

  // ---------- boot ----------
  render();
  (async () => {
    await store.init();
    try { state.sets = await store.list(); } catch (e) { flashMsg = "Couldn't load your sets: " + e.message; }
    render();
    // The local model can still be loading when the page opens: check again until it's up,
    // then switch the finder on without a reload.
    const waitForHelper = setInterval(async () => {
      if (store.helperUp) return clearInterval(waitForHelper);
      await store.init();
      if (store.helperUp && state.view === "library" && document.activeElement?.tagName !== "INPUT") render();
    }, 15000);
  })();
})();
