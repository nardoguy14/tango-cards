// い- and な-adjectives: finding them among a set's cards, and their polite present and past forms.
//
//                 affirmative        negative
//   い  present   高いです            高くないです
//       past      高かったです         高くなかったです
//   な  present   静かです            静かじゃないです
//       past      静かでした           静かじゃなかったです
//
// いい (and words ending in it, like かっこいい) conjugates from よい: よくないです, よかったです.
import type { Card } from "../types";

export type AdjType = "i" | "na";
export const ADJ_LABEL: Record<AdjType, string> = { i: "い-adjective", na: "な-adjective" };
export const TABLE_HEAD = ["", "affirmative", "negative"];

/** The adjective itself: 静か(な) -> 静か, without 〜 or notes in brackets. */
export const dictionaryForm = (jp: string) => jp.replace(/[（(][^）)]*[）)]/g, "").replace(/[〜～~\s]/g, "");

/** Is this card an adjective, and which kind? A guess the learner can correct. */
export function adjectiveType(card: Card): AdjType | null {
  if (card.kind === "grammar" || card.table) return null;
  const jp = card.jp.trim(), en = card.en.trim().toLowerCase();
  if (/[（(]\s*な\s*[）)]$/.test(jp) || /\bna-?adj/.test(en)) return "na";
  const word = dictionaryForm(jp);
  if (/[A-Za-z+]/.test(word) || en.startsWith("to ")) return null;          // patterns, verbs
  if (/i-?adj/.test(en)) return "i";
  // ends in い, after a kanji or kana: 高い, 楽しい, つまらない; not a lone い or a few nouns
  if (/[\u3040-\u309f\u4e00-\u9fff]い$/.test(word) && !NOT_ADJECTIVES.has(word)) return "i";
  return null;
}
// Words that end in い but aren't い-adjectives: nouns, and な-adjectives written without (な).
const NOT_ADJECTIVES = new Set([
  "きれい", "嫌い", "きらい", "有名", "ゆうめい", "失礼", "しつれい", "丁寧", "ていねい", "得意", "とくい",
  "時計", "とけい", "先生", "せんせい", "学生", "がくせい", "映画", "えいが", "携帯", "けいたい", "場合", "ばあい",
  "愛", "あい", "はい", "いいえ",
]);

/** [present affirmative, present negative, past affirmative, past negative], polite (です) forms. */
export function conjugate(word: string, type: AdjType): [string, string, string, string] {
  if (type === "na") return [`${word}です`, `${word}じゃないです`, `${word}でした`, `${word}じゃなかったです`];
  const stem = word.endsWith("いい") ? word.slice(0, -2) + "よ" : word.slice(0, -1); // いい -> よ
  return [`${word}です`, `${stem}くないです`, `${stem}かったです`, `${stem}くなかったです`];
}

/** A table card for an adjective: front asks for the forms, back shows them. */
export function tableCard(card: Card, type: AdjType, id: string): Card {
  const word = dictionaryForm(card.jp);
  const [pa, pn, qa, qn] = conjugate(word, type);
  const meaning = card.en.split(/[;\n]/)[0].replace(/\s*[（(][^）)]*[）)]/g, "").trim(); // "good-looking (conjugates like いい)" -> "good-looking"
  return {
    id, kind: "grammar",
    jp: word,
    reading: dictionaryForm(card.reading || ""),
    en: `${meaning}: present and past (${ADJ_LABEL[type]})`,
    table: [TABLE_HEAD, ["present", pa, pn], ["past", qa, qn]],
  };
}
