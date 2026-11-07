"""Making cards from photos: saves them to the set, then has the vision model read them."""

import asyncio
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app import db
from app.agent import MODEL, ExtractionError, extract_vocab

router = APIRouter(prefix="/api", tags=["extract"])
log = logging.getLogger("tango")

MAX_IMAGES = 12
MAX_INSTRUCTIONS = 1000
MAX_IMAGE_BYTES = 10 * 1024 * 1024
PARALLEL_CALLS = 4
IMAGE_TYPES = set(db.EXTENSIONS)


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


@router.post("/extract")
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
