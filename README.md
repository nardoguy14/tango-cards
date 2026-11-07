# Tango Cards 単語カード

Japanese–English flashcards made from photos of your vocab. Take a picture of a word list,
textbook page or handwritten notes, check the cards it found, and study them in sets from
either side with a card you flip and swipe.

- **Cards from photos.** An AI model reads each photo and makes the cards. You can also tell
  it what to make ("cards for the particles に, を and へ, with an example each").
- **Words and grammar.** Every card is either a *word* to memorize or a *grammar* rule
  (particles, conjugations, patterns). New cards are labeled automatically, and one tap moves
  a card to the other group.
- **Two ways to study a set.** *Smart learn* keeps a small rotation of cards until each one is
  cleared. *Review all* is one pass through the set. Both pick up where you stopped, and can
  be limited to words or grammar.
- **Practice across sets.** Random cards from any sets you choose, words, grammar or both.
- **Find cards.** Ask for a topic ("days of the week", "food and drinks", "particles for
  places") and a language model picks the matching cards from every set. Refine it ("only the
  verbs"), untick anything you don't want, then practice exactly those.
- Photos stay with their set, and every card links back to the photo it came from.
- Works on phones: swipe right for "got it", left for "again".

## Run it

The only thing to install is [uv](https://docs.astral.sh/uv/). It fetches the right Python
and every package on the first start.

1. Install uv:
   - **macOS / Linux:** `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - **Windows (PowerShell):** `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
2. Get the code: `git clone <this repo>`, or download it as a ZIP and unzip it.
3. Run the start script in the folder: `./start.sh` on macOS/Linux, or double-click
   `start.bat` on Windows. The first run creates `.env` and stops. Open `.env`, paste your
   Gemini API key after `GEMINI_API_KEY=`, save, and run the start script again.
4. Open http://localhost:8000. A phone on the same Wi-Fi can use
   `http://<this computer's IP>:8000`.

To use a different port: `PORT=8080 ./start.sh` (macOS/Linux), or `set PORT=8080` and then
`start.bat` (Windows). By hand:

```bash
cp .env.example .env        # then fill it in
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Settings (`.env`)

| Variable | What it does |
|---|---|
| `MODEL` | The model that reads photos, in LiteLLM's `provider/model` form. Default `gemini/gemini-2.5-flash`. |
| `GEMINI_API_KEY` (or `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OLLAMA_API_BASE`) | The key for that provider. |
| `DB_PATH`, `IMAGES_DIR` | Where sets and photos are stored. Default `data/`. |
| `HELPER_API_BASE` | Any OpenAI-compatible server for **Find cards**. Default `http://127.0.0.1:9200/v1` (a local vLLM). |
| `HELPER_MODEL` | The model name on that server. Default `qwen3.8-27b`. |
| `HELPER_API_KEY` | The key for that server, if it needs one. |

Photo reading works with any vision model LiteLLM supports:

| Provider  | `MODEL` example                | Key variable        |
|-----------|--------------------------------|---------------------|
| Gemini    | `gemini/gemini-2.5-flash`      | `GEMINI_API_KEY`    |
| OpenAI    | `openai/gpt-4.1-mini`          | `OPENAI_API_KEY`    |
| Anthropic | `anthropic/claude-sonnet-5-5`  | `ANTHROPIC_API_KEY` |
| Ollama    | `ollama_chat/qwen2.5vl`        | `OLLAMA_API_BASE`   |

**Find cards** needs a chat model that can return JSON. Without one, everything else works
and the finder says its model isn't running. A local model with vLLM:

```bash
vllm serve nvidia/Qwen3.8-27B-NVFP4 --served-model-name qwen3.8-27b --port 9200 --max-model-len 65536
```

A hosted API works too. For example, with OpenAI set `HELPER_API_BASE=https://api.openai.com/v1`,
`HELPER_MODEL=gpt-4.1-mini` and `HELPER_API_KEY=<your key>`.

## Your data

Sets, study progress and photos live in `data/`: `data/tango.db` (SQLite) and
`data/images/<set id>/`. They are **not** in git (see `.gitignore`). Back up `data/` to
keep them, and copy it to move them to another computer.

## Sharing it

There is no login. Anyone who can open the page can see and change every set, and their
photos and searches spend your model credits. Keep it on your own network, or share a
tunnel link (ngrok, Cloudflare) only with people you trust.

## How it fits together

The backend is FastAPI (Python). The page is a Vue 3 + TypeScript app built with Vite. The
built page is committed in `app/web/`, so running the app only needs uv. You need Node only
to change the front end.

```
app/                        backend
  main.py                   creates the app, wires the routes, serves the built page
  routes/
    sets.py                 sets, their cards, study progress
    photos.py               the photos each set was made from
    extract.py              photos -> cards (saves the photos, then the vision model reads them)
    find.py                 Find cards
  schemas.py                request bodies
  agent.py                  reads photos: Google ADK agent + LiteLLM model -> cards (word or grammar)
  finder.py                 asks an OpenAI-compatible model which cards match a request
  db.py                     SQLite for sets and photo records; photo files on disk
  web/                      the built page (generated: don't edit)

frontend/                   the page's source
  src/
    main.ts, App.vue        start-up, and which screen is showing
    store.ts                sets, screens and navigation (the phone's back button works), saving
    study.ts                study rounds: Review all, Smart learn, practice across sets
    finder.ts               the Find cards conversation
    prefs.ts                choices remembered on this device
    api.ts, types.ts        the API and its shapes
    lib/                    cards, progress and photo helpers
    composables/useSwipe.ts swiping a flashcard
    components/
      library/              home: Find cards, Practice across sets, your sets
      set/                  one set: practice, its cards, its photos, the round + button
      add/                  the add-cards screen: from photos, review what was found, type one in
      study/                the flashcard, its faces, the end of a round
      ui/                   the Options drawer and segmented buttons
    styles/                 tokens (colours, light and dark), then one file per area, and motion
```

### Changing the front end

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, live reload; /api goes to the server on :8000
npm run build    # type-checks, then writes app/web/ (commit it)
```

Set `API_TARGET=http://127.0.0.1:8090` before `npm run dev` if your server runs on another port.

| Method | Path | Body / result |
|---|---|---|
| GET | `/api/health` | `{ok, model, helper, helper_up}` |
| GET | `/api/sets` | every set with its cards and progress |
| POST | `/api/sets` | `{name, cards?}` → new set |
| PUT | `/api/sets/{id}` | `{name, cards}` → updated set. A card is `{id, jp, reading, en, kind: "word" or "grammar", image_id?}` |
| PUT | `/api/sets/{id}/progress` | where you stopped studying (JSON) → 204 |
| DELETE | `/api/sets/{id}` | 204, with its photos |
| GET | `/api/sets/{id}/images` | photos saved for a set |
| GET / DELETE | `/api/images/{id}` | a photo file / remove it |
| POST | `/api/extract` | multipart `set_id`, `files` (≤12 images, ≤10 MB each), optional `instructions` and `image_ids` → `{cards, images, errors}` |
| POST | `/api/find` | `{turns: [{role, text, ids?}], set_ids?}` → `{reply, cards}` |

`/api/extract` saves every photo to the set first, then reads them (4 at a time), so a photo
that fails to read is still kept. The page shrinks photos to 2000 px on the long side before
upload.

## Limits

- One shared library: no accounts, and everyone shares the same sets and progress.
- SQLite and local files suit one small server. For more, move photos to object storage and
  sets to Postgres; only `app/db.py` needs to change.
