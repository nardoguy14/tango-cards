"""Tango Cards web service: the JSON API under /api, and the built Vue page.

Run:  uv run uvicorn app.main:app --port 8000

Routes live in app/routes/ (sets, photos, extract, find). The page is built from
frontend/ into app/web/ by `npm run build`.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # before importing modules that read env vars

from fastapi import FastAPI  # noqa: E402
from fastapi.responses import FileResponse, PlainTextResponse  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402

from app import db, finder  # noqa: E402
from app.agent import MODEL  # noqa: E402
from app.routes import extract, find, photos, sets  # noqa: E402

WEB = Path(__file__).parent / "web"


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield


app = FastAPI(title="Tango Cards", lifespan=lifespan)
for module in (sets, photos, extract, find):
    app.include_router(module.router)


@app.get("/api/health")
async def health():
    return {"ok": True, "model": MODEL, "helper": finder.MODEL, "helper_up": await finder.available()}


# ---------- the page ----------

@app.get("/")
def index():
    page = WEB / "index.html"
    if not page.exists():
        return PlainTextResponse("The page isn't built yet. Run `npm install && npm run build` in frontend/.", 503)
    # no-cache: browsers check for a newer page on every visit instead of showing a stale one
    return FileResponse(page, headers={"Cache-Control": "no-cache"})


class _Immutable(StaticFiles):
    """Vite puts a content hash in every asset name, so a file never changes under its name."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


if (WEB / "assets").is_dir():
    app.mount("/assets", _Immutable(directory=WEB / "assets"), name="assets")
