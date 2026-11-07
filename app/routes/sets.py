"""Sets: their cards, and where you stopped studying them."""

import json

from fastapi import APIRouter, HTTPException

from app import db
from app.schemas import SetIn

router = APIRouter(prefix="/api/sets", tags=["sets"])


@router.get("")
def list_sets():
    return db.list_sets()


@router.post("", status_code=201)
def create_set(body: SetIn):
    return db.create_set(body.name.strip(), body.card_dicts())


@router.put("/{set_id}")
def update_set(set_id: str, body: SetIn):
    updated = db.update_set(set_id, body.name.strip(), body.card_dicts())
    if not updated:
        raise HTTPException(404, "Set not found")
    return updated


@router.put("/{set_id}/progress", status_code=204)
def save_progress(set_id: str, progress: dict):
    """Where you stopped studying this set. The page owns the shape; the server just keeps it."""
    if len(json.dumps(progress)) > 200_000:
        raise HTTPException(413, "Progress is too large.")
    if not db.set_progress(set_id, progress):
        raise HTTPException(404, "Set not found")


@router.delete("/{set_id}", status_code=204)
def delete_set(set_id: str):
    if not db.delete_set(set_id):
        raise HTTPException(404, "Set not found")
