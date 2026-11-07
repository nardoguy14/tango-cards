"""Find cards: ask a language model for the cards on a topic, across sets."""

from fastapi import APIRouter, HTTPException

from app import db, finder
from app.schemas import FindIn

router = APIRouter(prefix="/api", tags=["find"])


@router.post("/find")
async def find(body: FindIn):
    """The whole conversation comes in each time; the reply's cards come back in the model's
    order, each tagged with the set it belongs to.
    """
    if body.turns[-1].role != "user" or not body.turns[-1].text.strip():
        raise HTTPException(400, "Write what you're looking for.")
    sets = [s for s in db.list_sets() if body.set_ids is None or s["id"] in body.set_ids]
    cards = [c | {"set_id": s["id"], "set_name": s["name"]} for s in sets for c in s["cards"]]
    if not cards:
        raise HTTPException(400, "There are no cards to search yet.")
    try:
        reply, ids = await finder.find_cards(cards, [t.model_dump() for t in body.turns])
    except finder.HelperError as e:
        raise HTTPException(503, str(e))
    by_id = {c["id"]: c for c in cards}
    return {"reply": reply, "cards": [by_id[i] for i in ids]}
