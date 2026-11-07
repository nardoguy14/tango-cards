"""Vocabulary extraction agent: Google ADK running any model through LiteLLM.

Pick the model with the MODEL env var using LiteLLM's "provider/model" names, e.g.
  gemini/gemini-2.5-flash, openai/gpt-4.1-mini, anthropic/claude-sonnet-5-5,
  ollama_chat/qwen2.5vl (local). The model must accept images.
"""

import json
import os
import re
import uuid

from google.adk.agents import LlmAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import BaseModel, ValidationError

os.environ.setdefault("ADK_SUPPRESS_GEMINI_LITELLM_WARNINGS", "true")

APP_NAME = "tango_cards"
MODEL = os.getenv("MODEL", "gemini/gemini-2.5-flash")

INSTRUCTION = """You make Japanese–English flashcards from photos or screenshots of Japanese
study material: vocabulary lists, textbook pages, grammar explanations, handwritten notes.

Every card has four fields:
- "jp": the Japanese side, exactly as written (a word, phrase, particle, grammar pattern or
  example sentence)
- "reading": hiragana for any kanji in "jp" (use the furigana shown if there is any),
  otherwise ""
- "en": the English side: a short meaning for vocabulary; for grammar, what the point
  means or does, in one or two plain sentences, optionally followed by one example
- "kind": "grammar" or "word". Use "grammar" for anything that is a rule rather than a word
  to memorize: particles (は, を, に, で, へ, と, も, の…), suffixes that attach before or after
  other words (〜ぐらい, 〜ごろ, 〜時に…), conjugations and verb/adjective forms (〜ます,
  〜ません, 〜ました, 〜じゃないです, 〜て form…), sentence patterns (あまり + negative,
  〜ませんか…) and explanations of how sentences work (word order, when to use います vs
  あります). Use "word" for vocabulary: nouns, verbs and adjectives in their dictionary form,
  adverbs, set phrases and greetings, even when the card notes which particle they take
  (行く "to go (destination に/へ)" is a word).

If the learner gives instructions, follow them: make exactly the cards they ask for, using
the page as context (its explanations, examples and readings), even when what they ask
about is grammar rather than vocabulary. Several cards per point is fine when it helps,
for example one card for the rule and one for an example sentence from the page. If the page
doesn't cover something they asked for, make the card from standard Japanese usage.

Without instructions, extract every vocabulary item in the order it appears and skip page
numbers, headings and exercise instructions. If the image has no English for an item, write
the standard English meaning yourself.

Reply with only a JSON array and no other text, for example:
[{"jp":"食べる","reading":"たべる","en":"to eat","kind":"word"},
 {"jp":"に","reading":"","en":"Marks a destination, a point in time, or where something exists. 学校に行きます = I go to school.","kind":"grammar"}]"""

MAX_JP, MAX_READING, MAX_EN = 200, 200, 600


KINDS = ("word", "grammar")


class Card(BaseModel):
    jp: str = ""
    reading: str = ""
    en: str = ""
    kind: str | None = "word"


class ExtractionError(Exception):
    pass


vocab_agent = LlmAgent(
    name="vocab_extractor",
    model=LiteLlm(model=MODEL),
    description="Extracts Japanese–English vocabulary from images.",
    instruction=INSTRUCTION,
)

runner = InMemoryRunner(agent=vocab_agent, app_name=APP_NAME)


def _parse_cards(text: str) -> list[Card]:
    """Read a JSON array from the model reply, tolerating code fences or a stray sentence."""
    candidates = [text]
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fence:
        candidates.append(fence.group(1))
    start, end = text.find("["), text.rfind("]")
    if start != -1 and end > start:
        candidates.append(text[start : end + 1])

    for candidate in candidates:
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            data = data.get("cards") or data.get("vocab") or []
        if not isinstance(data, list):
            continue
        cards = []
        for item in data:
            try:
                card = Card.model_validate(item)
            except ValidationError:
                continue
            kind = (card.kind or "").strip().lower()
            card = Card(
                jp=card.jp.strip()[:MAX_JP],
                reading=card.reading.strip()[:MAX_READING],
                en=card.en.strip()[:MAX_EN],
                kind=kind if kind in KINDS else "word",
            )
            if card.jp or card.en:
                cards.append(card)
        return cards
    raise ExtractionError("The model's reply wasn't a JSON list of cards.")


async def extract_vocab(images: list[tuple[bytes, str]], instructions: str = "") -> list[Card]:
    """Send images (bytes, mime type) to the agent and return the cards it makes.

    With `instructions` (the learner's own request, e.g. "cards for the particles に, を, へ")
    the agent makes those cards using the images as context; without, it lists the vocabulary.
    """
    user_id = "service"
    session = await runner.session_service.create_session(
        app_name=APP_NAME, user_id=user_id, session_id=uuid.uuid4().hex
    )
    if instructions:
        request = (
            f"Use these {len(images)} image(s) as context. The learner's instructions:\n"
            f"<instructions>\n{instructions}\n</instructions>"
        )
    else:
        request = f"Extract the vocabulary from {len(images)} image(s)."
    parts = [types.Part(text=request)]
    parts += [types.Part.from_bytes(data=data, mime_type=mime) for data, mime in images]
    message = types.Content(role="user", parts=parts)

    reply = ""
    try:
        async for event in runner.run_async(
            user_id=user_id, session_id=session.id, new_message=message
        ):
            if event.is_final_response() and event.content and event.content.parts:
                reply = "".join(p.text or "" for p in event.content.parts)
            if event.error_message:
                raise ExtractionError(event.error_message)
    finally:
        await runner.session_service.delete_session(
            app_name=APP_NAME, user_id=user_id, session_id=session.id
        )

    if not reply.strip():
        raise ExtractionError("The model returned an empty reply.")
    return _parse_cards(reply)
