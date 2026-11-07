"""Card finder: a local LLM picks the cards that match what the learner asks for.

The model sees every card (numbered) plus the conversation so far, and answers with a short
reply and the numbers of the matching cards. Follow-ups like "only the verbs" or "add the
months too" work because earlier answers are replayed as the cards they picked.

Talks to any OpenAI-compatible server; by default the vLLM on this box:
  HELPER_API_BASE=http://127.0.0.1:9200/v1   HELPER_MODEL=qwen3.8-27b
"""

import json
import os
import re

import httpx

API_BASE = os.getenv("HELPER_API_BASE", "http://127.0.0.1:9200/v1").rstrip("/")
MODEL = os.getenv("HELPER_MODEL", "qwen3.8-27b")
API_KEY = os.getenv("HELPER_API_KEY", "none")
THINKING = os.getenv("HELPER_THINKING", "0") == "1"
TIMEOUT = float(os.getenv("HELPER_TIMEOUT", "180"))
MAX_EN = 160          # long grammar explanations are cut in the catalogue; the start says enough

SYSTEM = """You help a learner of Japanese pick flashcards to study. Below is every card they
have, one per line: number, type (W = word to memorize, G = grammar rule), Japanese, reading,
English, and the set it is in.

When they ask for cards ("days of the week", "verbs of motion", "food", "particles for
places", "things I'd say on the phone"), choose every card that fits, judging by meaning,
not only by matching words. Include close matches a learner would want in the same session
(for "days of the week", also 週末 weekend and 毎日 every day is fine; for "food", drinks and
meals too). When the same word appears twice, include both. If they refine the previous
answer ("only the kanji ones", "drop the grammar", "add the months"), start from the cards
you picked last time and adjust. If nothing fits, return no cards and say so.

Go through the whole list before answering. Cards on one topic are often spread across
sets and far apart in the list, and missing one that fits is worse than including one that
is borderline.

Answer with JSON only: {"reply": "<one or two short sentences about what you picked>",
"cards": [<card numbers>]}

Cards:
"""

SCHEMA = {
    "type": "object",
    "properties": {
        "reply": {"type": "string"},
        "cards": {"type": "array", "items": {"type": "integer"}},
    },
    "required": ["reply", "cards"],
}


class HelperError(Exception):
    pass


def _catalogue(cards: list[dict]) -> str:
    lines = []
    for n, c in enumerate(cards, 1):
        en = " ".join(c.get("en", "").split())
        en = en if len(en) <= MAX_EN else en[: MAX_EN - 1] + "…"
        kind = "G" if c.get("kind") == "grammar" else "W"
        reading = f" ({c['reading']})" if c.get("reading") else ""
        lines.append(f"{n}. [{kind}] {c.get('jp', '')}{reading} — {en} · {c['set_name']}")
    return "\n".join(lines)


def _parse(text: str) -> dict:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    for candidate in (text, (re.search(r"\{.*\}", text, re.S) or [None])[0]):
        if not candidate:
            continue
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    raise HelperError("The model's answer wasn't the JSON it was asked for. Try asking again.")


async def find_cards(cards: list[dict], turns: list[dict]) -> tuple[str, list[str]]:
    """Return (reply, card ids) for the last user turn.

    `cards` carry id, jp, reading, en, kind and set_name. `turns` alternate
    {"role": "user", "text"} and {"role": "assistant", "text", "ids"}; assistant turns are
    replayed as the numbers of the cards they picked, so refinements build on them.
    """
    number = {c["id"]: n for n, c in enumerate(cards, 1)}
    messages = [{"role": "system", "content": SYSTEM + _catalogue(cards)}]
    for t in turns:
        if t["role"] == "assistant":
            picked = [number[i] for i in t.get("ids", []) if i in number]
            messages.append({"role": "assistant", "content": json.dumps({"reply": t.get("text", ""), "cards": picked}, ensure_ascii=False)})
        else:
            messages.append({"role": "user", "content": t.get("text", "")})

    body = {
        "model": MODEL,
        "messages": messages,
        "temperature": 0,
        "max_tokens": 2048,
        "response_format": {"type": "json_schema", "json_schema": {"name": "cards", "schema": SCHEMA}},
        "chat_template_kwargs": {"enable_thinking": THINKING},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(f"{API_BASE}/chat/completions", json=body,
                                  headers={"Authorization": f"Bearer {API_KEY}"})
    except httpx.ConnectError:
        raise HelperError(f"The card finder's model ({MODEL}) isn't running.")
    except httpx.TimeoutException:
        raise HelperError("The model took too long to answer. Try a shorter request.")
    if r.status_code != 200:
        raise HelperError(f"The model returned an error ({r.status_code}).")
    data = _parse(r.json()["choices"][0]["message"].get("content") or "")

    ids, seen = [], set()
    for n in data.get("cards") or []:
        if isinstance(n, int) and 1 <= n <= len(cards) and n not in seen:
            seen.add(n)
            ids.append(cards[n - 1]["id"])
    return str(data.get("reply") or "").strip(), ids


async def available() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{API_BASE}/models", headers={"Authorization": f"Bearer {API_KEY}"})
        return r.status_code == 200 and any(m.get("id") == MODEL for m in r.json().get("data", []))
    except (httpx.HTTPError, ValueError):
        return False
