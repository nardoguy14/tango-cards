"""Simple card search: what Find cards falls back to when no language model is reachable.

It looks for the words you type, in English or Japanese, in each card's Japanese, reading and
English sides:

- Japanese: a match anywhere in the Japanese or the reading. Katakana and hiragana count as
  the same, so ねこ finds 猫 (ねこ) and ネコ.
- English: filler ("give me cards about the …") is dropped, plurals and -ing are trimmed, and
  each word is matched against the words on the English side: a whole word, or the end of a
  compound ("day" in "Monday"), scores highest, then the start of a word, then anywhere inside one.
- A few words narrow the results instead: grammar / particles / conjugations (grammar cards),
  words / vocabulary (word cards), verbs (English that starts with "to …").

Cards come back best match first; a card matching more of your words ranks higher.
"""

import re
import unicodedata

MAX_RESULTS = 80

STOPWORDS = {
    "a", "an", "and", "the", "of", "for", "to", "in", "on", "at", "with", "about", "related",
    "give", "me", "show", "find", "get", "want", "need", "i", "my", "all", "some", "any",
    "card", "cards", "please", "that", "are", "is", "which", "what", "ones", "one", "like",
    "japanese", "english", "only", "just", "study", "practice", "list",
}
GRAMMAR_WORDS = {"grammar", "particle", "particles", "conjugation", "conjugations", "pattern", "patterns", "rule", "rules"}
WORD_WORDS = {"word", "words", "vocab", "vocabulary"}
VERB_WORDS = {"verb", "verbs"}

_JP = re.compile(r"[぀-ヿ㐀-鿿ｦ-ﾟ]")
_WORD = re.compile(r"[a-z0-9']+")


def _norm_jp(text: str) -> str:
    """NFKC, lowercase, katakana -> hiragana, no spaces or 〜 marks."""
    text = unicodedata.normalize("NFKC", text).lower()
    text = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)
    return re.sub(r"[\s〜~～・、。,.]", "", text)


def _stem(word: str) -> str:
    word = word.removesuffix("'s")
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 5 and word.endswith("ing"):
        return word[:-3]
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


def _english_score(stem: str, words: list[str]) -> int:
    best = 0
    for w in words:
        if w == stem or _stem(w) == stem or (len(stem) >= 3 and _stem(w).endswith(stem)):
            return 3                     # the word itself, or the end of a compound ("day" in "Monday")
        if w.startswith(stem):
            best = max(best, 2)
        elif len(stem) >= 3 and stem in w:
            best = max(best, 1)
    return best


def search(cards: list[dict], query: str) -> tuple[str, list[str]]:
    """Return (reply, card ids) for a plain-text query over `cards` (each with id, jp, reading, en, kind)."""
    query = query.strip()
    jp_terms = [_norm_jp(t) for t in re.split(r"[\s、,]+", query) if _JP.search(t)]
    jp_terms = [t for t in jp_terms if t]
    en_words = _WORD.findall(unicodedata.normalize("NFKC", query).lower())

    kind = verbs = None
    terms: list[str] = []
    typed: list[str] = []                # the words as typed, for the reply
    for w in en_words:
        if w in GRAMMAR_WORDS:
            kind = "grammar"
        elif w in WORD_WORDS:
            kind = "word"
        elif w in VERB_WORDS:
            verbs = True
        elif w not in STOPWORDS and len(w) > 1 and _stem(w) not in terms:
            terms.append(_stem(w))
            typed.append(w)

    if not (jp_terms or terms or kind or verbs):
        return "Type a word to look for, in English or Japanese: week, ねこ, 学校…", []

    scored = []
    for order, c in enumerate(cards):
        if kind and (c.get("kind") == "grammar") != (kind == "grammar"):
            continue
        en = c.get("en", "").lower()
        if verbs and not en.startswith("to "):
            continue
        score = matched = 0
        if jp_terms:
            jp = _norm_jp(c.get("jp", "")) + "|" + _norm_jp(c.get("reading", ""))
            for t in jp_terms:
                if t in jp:
                    matched += 1
                    exact = t in (_norm_jp(c.get("jp", "")), _norm_jp(c.get("reading", "")))
                    score += 4 if exact else 2
        if terms:
            words = _WORD.findall(en)
            for t in terms:
                s = _english_score(t, words)
                if s:
                    matched += 1
                    score += s
        if not jp_terms and not terms:   # only a filter word, like "verbs" or "grammar"
            score = matched = 1
        if matched:
            scored.append((-matched, -score, order, c["id"]))

    scored.sort()
    ids = [cid for *_, cid in scored[:MAX_RESULTS]]
    # the bubble already shows how many: the reply only says what was searched
    shown = ", ".join(f'"{t}"' for t in jp_terms + typed)
    narrowing = " ".join(filter(None, [{"grammar": "grammar", "word": "word"}.get(kind or "", ""), "verbs" if verbs else ("cards" if kind else "")]))
    if not shown:
        return (f"All your {narrowing}." if ids else f"You have no {narrowing} yet."), ids
    within = f" (only {narrowing})" if narrowing else ""
    if not ids:
        return f"No cards contain {shown}{within}. Try another word, in English or Japanese.", []
    more = f" Showing the best {MAX_RESULTS}." if len(scored) > MAX_RESULTS else ""
    return f"Cards with {shown}{within}.{more}", ids
