"""Request bodies the API accepts. Responses are plain dicts from app.db."""

from typing import Literal

from pydantic import BaseModel, Field


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

    def card_dicts(self) -> list[dict]:
        return [c.model_dump(exclude_none=True) for c in self.cards]


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field("", max_length=1000)
    ids: list[str] = Field(default_factory=list, max_length=2000)


class FindIn(BaseModel):
    turns: list[Turn] = Field(min_length=1, max_length=30)
    set_ids: list[str] | None = None      # None: every set
