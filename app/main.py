"""Tango Cards web service: serves the page and a small JSON API.

Run:  uv run uvicorn app.main:app --port 8000
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

load_dotenv()  # before importing modules that read env vars

from fastapi import FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from app import db, helper  # noqa: E402
from app.agent import MODEL, ExtractionError, extract_vocab  # noqa: E402

log = logging.getLogger("tango")
STATIC = Path(__file__).parent / "static"
MAX_IMAGES = 12
MAX_INSTRUCTIONS = 1000
MAX_IMAGE_BYTES = 10 * 1024 * 1024
PARALLEL_CALLS = 4
IMAGE_TYPES = set(db.EXTENSIONS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield


app = FastAPI(title="Tango Cards", lifespan=lifespan)


class CardIn(BaseModel):
    id: str = Field(max_length=64)
    jp: str = Field("", max_length=200)
    reading: str = Field("", max_length=200)
    en: str = Field("", max_length=600)
    kind: Literal["word", "grammar"] = "word"
    image_id: str | None = Field(None, max_length=64)


class SetIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    cards: list[CardIn] = Field(default_factory=list, max_length=2000)


def _dump(cards: list[CardIn]) -> list[dict]:
    return [c.model_dump(exclude_none=True) for c in cards]


@app.get("/api/health")
async def health():
    return {"ok": True, "model": MODEL, "helper": helper.MODEL, "helper_up": await helper.available()}


# ---------- card finder ----------

class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field("", max_length=1000)
    ids: list[str] = Field(default_factory=list, max_length=2000)


class FindIn(BaseModel):
    turns: list[Turn] = Field(min_length=1, max_length=30)
    set_ids: list[str] | None = None      # None: every set


@app.post("/api/find")
async def find(body: FindIn):
    """Ask the local model for the cards that match a request, across sets.

    The whole conversation comes in each time; the reply's cards come back in the model's
    order, each tagged with the set it belongs to.
    """
    if body.turns[-1].role != "user" or not body.turns[-1].text.strip():
        raise HTTPException(400, "Write what you're looking for.")
    sets = [s for s in db.list_sets() if body.set_ids is None or s["id"] in body.set_ids]
    cards = [c | {"set_id": s["id"], "set_name": s["name"]} for s in sets for c in s["cards"]]
    if not cards:
        raise HTTPException(400, "There are no cards to search yet.")
    try:
        reply, ids = await helper.find_cards(cards, [t.model_dump() for t in body.turns])
    except helper.HelperError as e:
        raise HTTPException(503, str(e))
    by_id = {c["id"]: c for c in cards}
    return {"reply": reply, "cards": [by_id[i] for i in ids]}


# ---------- sets ----------

@app.get("/api/sets")
def list_sets():
    return db.list_sets()


@app.post("/api/sets", status_code=201)
def create_set(body: SetIn):
    return db.create_set(body.name.strip(), _dump(body.cards))


@app.put("/api/sets/{set_id}")
def update_set(set_id: str, body: SetIn):
    updated = db.update_set(set_id, body.name.strip(), _dump(body.cards))
    if not updated:
        raise HTTPException(404, "Set not found")
    return updated


@app.put("/api/sets/{set_id}/progress", status_code=204)
def save_progress(set_id: str, progress: dict):
    """Where you stopped studying this set. The page owns the shape; the server just keeps it."""
    if len(json.dumps(progress)) > 200_000:
        raise HTTPException(413, "Progress is too large.")
    if not db.set_progress(set_id, progress):
        raise HTTPException(404, "Set not found")


@app.delete("/api/sets/{set_id}", status_code=204)
def delete_set(set_id: str):
    if not db.delete_set(set_id):
        raise HTTPException(404, "Set not found")


# ---------- images ----------

@app.get("/api/sets/{set_id}/images")
def list_images(set_id: str):
    if not db.get_set(set_id):
        raise HTTPException(404, "Set not found")
    return db.list_images(set_id)


@app.get("/api/images/{image_id}")
def get_image(image_id: str):
    found = db.image_file(image_id)
    if not found or not found[0].exists():
        raise HTTPException(404, "Image not found")
    path, mime = found
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "private, max-age=86400"})


@app.delete("/api/images/{image_id}", status_code=204)
def delete_image(image_id: str):
    if not db.delete_image(image_id):
        raise HTTPException(404, "Image not found")


def _friendly(e: Exception) -> str:
    name = type(e).__name__
    if isinstance(e, ExtractionError):
        return str(e)
    if name == "AuthenticationError":
        return f"The API key for {MODEL} is missing or invalid. Check the server's .env."
    if name == "RateLimitError":
        return f"{MODEL} is rate limiting requests. Wait a minute and try again."
    if name in ("NotFoundError", "BadRequestError"):
        return f"{MODEL} rejected the request. Check that the model name is right and that it accepts images."
    return f"The call to {MODEL} failed ({name})."


@app.post("/api/extract")
async def extract(
    set_id: str = Form(...),
    files: list[UploadFile] = File(default=[]),
    instructions: str = Form(""),
    image_ids: str = Form(""),
):
    """Make cards for a set from new photos (saved to the set first) and/or photos it already has.

    Without `instructions`, each photo is read on its own for its vocabulary. With them, all the
    photos go to the model together as context for that one request (e.g. "cards for the
    particles に, を, へ"), which can return any number of cards, grammar included.
    """
    if not db.get_set(set_id):
        raise HTTPException(404, "Set not found")
    instructions = instructions.strip()
    if len(instructions) > MAX_INSTRUCTIONS:
        raise HTTPException(400, f"Keep the instructions under {MAX_INSTRUCTIONS} characters.")
    saved_ids = [i for i in image_ids.split(",") if i.strip()]
    if not files and not saved_ids:
        raise HTTPException(400, "Add a photo or pick one of the set's saved photos.")
    if len(files) + len(saved_ids) > MAX_IMAGES:
        raise HTTPException(400, f"Use at most {MAX_IMAGES} photos at a time.")

    uploads = []
    for f in files:
        if f.content_type not in IMAGE_TYPES:
            raise HTTPException(400, f"{f.filename}: use a JPEG, PNG, WebP or GIF image.")
        data = await f.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(400, f"{f.filename} is over 10 MB.")
        uploads.append((data, f.content_type, f.filename or "photo"))

    # (image record, bytes, mime) for every photo this request uses
    pages: list[tuple[dict, bytes, str]] = []
    known = {img["id"]: img for img in db.list_images(set_id)}
    for image_id in saved_ids:
        found = db.image_file(image_id)
        if image_id not in known or not found or not found[0].exists():
            raise HTTPException(404, "One of the chosen photos isn't in this set anymore.")
        pages.append((known[image_id], found[0].read_bytes(), found[1]))
    saved = [db.save_image(set_id, data, mime, name) for data, mime, name in uploads]
    pages += [(img, data, mime) for img, (data, mime, _) in zip(saved, uploads)]

    cards, errors = [], []
    if instructions:
        try:
            made = await extract_vocab([(data, mime) for _, data, mime in pages], instructions)
            only = pages[0][0]["id"] if len(pages) == 1 else None
            cards = [c.model_dump() | ({"image_id": only} if only else {}) for c in made]
        except Exception as e:
            log.warning("extract failed: %s: %s", type(e).__name__, e)
            errors.append({"error": _friendly(e)})
    else:
        gate = asyncio.Semaphore(PARALLEL_CALLS)

        async def read_one(image: dict, data: bytes, mime: str):
            async with gate:
                found = await extract_vocab([(data, mime)])
            return [c.model_dump() | {"image_id": image["id"]} for c in found]

        results = await asyncio.gather(
            *(read_one(img, data, mime) for img, data, mime in pages), return_exceptions=True
        )
        for (img, _, _), result in zip(pages, results):
            if isinstance(result, Exception):
                log.warning("extract failed for %s: %s: %s", img["id"], type(result).__name__, result)
                errors.append({"image_id": img["id"], "filename": img["filename"], "error": _friendly(result)})
            else:
                cards += result
    return {"cards": cards, "images": saved, "errors": errors, "model": MODEL}


# ---------- page ----------

@app.get("/")
def index():
    # no-cache: browsers check for a newer page on every visit instead of showing a stale one
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})


class _Revalidated(StaticFiles):
    """Static files that browsers re-check on every load (cheap 304s), so an update shows at once."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-cache"
        return response


app.mount("/static", _Revalidated(directory=STATIC), name="static")
