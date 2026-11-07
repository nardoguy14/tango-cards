"""The photos each set was made from."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app import db

router = APIRouter(prefix="/api", tags=["photos"])


@router.get("/sets/{set_id}/images")
def list_images(set_id: str):
    if not db.get_set(set_id):
        raise HTTPException(404, "Set not found")
    return db.list_images(set_id)


@router.get("/images/{image_id}")
def get_image(image_id: str):
    found = db.image_file(image_id)
    if not found or not found[0].exists():
        raise HTTPException(404, "Image not found")
    path, mime = found
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "private, max-age=86400"})


@router.delete("/images/{image_id}", status_code=204)
def delete_image(image_id: str):
    if not db.delete_image(image_id):
        raise HTTPException(404, "Image not found")
