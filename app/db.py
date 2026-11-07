"""Storage for flashcard sets and the photos they were made from.

Sets and image records live in SQLite; image files live on disk under IMAGES_DIR/<set id>/.
Each set keeps its cards as a JSON list; a card made from a photo carries that photo's image_id.
Each set also keeps study progress (where you stopped in Smart learn and Review all) as JSON.
"""

import json
import os
import shutil
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", "data/tango.db")
IMAGES_DIR = Path(os.getenv("IMAGES_DIR", "data/images"))
EXTENSIONS = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS sets (
                 id      TEXT PRIMARY KEY,
                 name    TEXT NOT NULL,
                 cards   TEXT NOT NULL DEFAULT '[]',
                 created REAL NOT NULL,
                 updated REAL NOT NULL
               )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS images (
                 id        TEXT PRIMARY KEY,
                 set_id    TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
                 filename  TEXT NOT NULL,
                 mime      TEXT NOT NULL,
                 size      INTEGER NOT NULL,
                 created   REAL NOT NULL
               )"""
        )
        conn.execute("CREATE INDEX IF NOT EXISTS images_by_set ON images(set_id, created)")
        columns = {r["name"] for r in conn.execute("PRAGMA table_info(sets)")}
        if "progress" not in columns:  # added after the first release
            conn.execute("ALTER TABLE sets ADD COLUMN progress TEXT NOT NULL DEFAULT '{}'")


# ---------- sets ----------

def _set_row(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "cards": json.loads(r["cards"]),
        "progress": json.loads(r["progress"] or "{}"),
        "created": r["created"],
        "updated": r["updated"],
    }


def list_sets() -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM sets ORDER BY created").fetchall()
        counts = dict(conn.execute("SELECT set_id, COUNT(*) FROM images GROUP BY set_id").fetchall())
    return [{**_set_row(r), "image_count": counts.get(r["id"], 0)} for r in rows]


def get_set(set_id: str) -> dict | None:
    with connect() as conn:
        r = conn.execute("SELECT * FROM sets WHERE id = ?", (set_id,)).fetchone()
    return _set_row(r) if r else None


def create_set(name: str, cards: list[dict] | None = None) -> dict:
    now = time.time()
    set_id = uuid.uuid4().hex[:12]
    with connect() as conn:
        conn.execute(
            "INSERT INTO sets (id, name, cards, created, updated) VALUES (?, ?, ?, ?, ?)",
            (set_id, name, json.dumps(cards or [], ensure_ascii=False), now, now),
        )
    return get_set(set_id)


def update_set(set_id: str, name: str, cards: list[dict]) -> dict | None:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE sets SET name = ?, cards = ?, updated = ? WHERE id = ?",
            (name, json.dumps(cards, ensure_ascii=False), time.time(), set_id),
        )
    return get_set(set_id) if cur.rowcount else None


def set_progress(set_id: str, progress: dict) -> bool:
    """Replace a set's study progress. Doesn't touch `updated`, which tracks card edits."""
    with connect() as conn:
        cur = conn.execute(
            "UPDATE sets SET progress = ? WHERE id = ?",
            (json.dumps(progress, ensure_ascii=False), set_id),
        )
    return cur.rowcount > 0


def delete_set(set_id: str) -> bool:
    with connect() as conn:
        cur = conn.execute("DELETE FROM sets WHERE id = ?", (set_id,))  # cascades to images
    shutil.rmtree(IMAGES_DIR / set_id, ignore_errors=True)
    return cur.rowcount > 0


# ---------- images ----------

def _image_row(r: sqlite3.Row) -> dict:
    return {k: r[k] for k in ("id", "set_id", "filename", "mime", "size", "created")} | {
        "url": f"/api/images/{r['id']}"
    }


def save_image(set_id: str, data: bytes, mime: str, filename: str) -> dict:
    image_id = uuid.uuid4().hex[:16]
    folder = IMAGES_DIR / set_id
    folder.mkdir(parents=True, exist_ok=True)
    (folder / (image_id + EXTENSIONS[mime])).write_bytes(data)
    with connect() as conn:
        conn.execute(
            "INSERT INTO images (id, set_id, filename, mime, size, created) VALUES (?, ?, ?, ?, ?, ?)",
            (image_id, set_id, filename[:200], mime, len(data), time.time()),
        )
        r = conn.execute("SELECT * FROM images WHERE id = ?", (image_id,)).fetchone()
    return _image_row(r)


def list_images(set_id: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM images WHERE set_id = ? ORDER BY created", (set_id,)
        ).fetchall()
    return [_image_row(r) for r in rows]


def image_file(image_id: str) -> tuple[Path, str] | None:
    with connect() as conn:
        r = conn.execute("SELECT set_id, mime FROM images WHERE id = ?", (image_id,)).fetchone()
    if not r:
        return None
    return IMAGES_DIR / r["set_id"] / (image_id + EXTENSIONS[r["mime"]]), r["mime"]


def delete_image(image_id: str) -> bool:
    found = image_file(image_id)
    if not found:
        return False
    with connect() as conn:
        conn.execute("DELETE FROM images WHERE id = ?", (image_id,))
    found[0].unlink(missing_ok=True)
    return True
