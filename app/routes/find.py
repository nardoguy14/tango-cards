"""Find cards: ask a language model for the cards on a topic, across sets.

With no model reachable (none configured, or it's down), the last thing you typed goes to a
simple word search instead (app/search.py), so the finder always answers.
"""

import logging

from fastapi import APIRouter, HTTPException

from app import db, finder, search
from app.schemas import FindIn

router = APIRouter(prefix="/api", tags=["find"])
log = logging.getLogger("tango")


@router.post("/find")
async def find(body: FindIn):
    """The whole conversation comes in each time; the reply's cards come back best first, each
    tagged with the set it belongs to. `mode` says which way they were found: "ai" or "simple".
    """
    query = body.turns[-1].text.strip()
    if body.turns[-1].role != "user" or not query:
        raise HTTPException(400, "Write what you're looking for.")
    sets = [s for s in db.list_sets() if body.set_ids is None or s["id"] in body.set_ids]
    cards = [c | {"set_id": s["id"], "set_name": s["name"]} for s in sets for c in s["cards"]]
    if not cards:
        raise HTTPException(400, "There are no cards to search yet.")

    mode = "simple"
    if await finder.available():
        try:
            reply, ids = await finder.find_cards(cards, [t.model_dump() for t in body.turns])
            mode = "ai"
        except finder.HelperError as e:
            log.warning("finder model failed, using simple search: %s", e)
    if mode == "simple":
        reply, ids = search.search(cards, query)

    by_id = {c["id"]: c for c in cards}
    return {"reply": reply, "cards": [by_id[i] for i in ids], "mode": mode}
