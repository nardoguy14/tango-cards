// Hearing a card: the browser's own Japanese voice (Web Speech API). Free, no server, works
// offline on most phones. Quality depends on the device: iPhones have Kyoko / O-ren, Android
// uses Google's voice, desktop Chrome has "Google 日本語".
import { reactive } from "vue";
import type { Card } from "../types";

// Better-sounding voices first, when the device has them.
const PREFERRED = [/google.*日本語/i, /o-?ren/i, /kyoko/i, /nanami/i, /haruka/i, /otoya/i, /ayumi/i, /ichiro/i];
const synth: SpeechSynthesis | undefined = typeof window !== "undefined" ? window.speechSynthesis : undefined;

export const speech = reactive({
  supported: !!synth,
  /** The Japanese voice in use, once the browser has listed its voices. */
  voice: "" as string,
  /** Key of what's playing now, so its button can show it. */
  playing: null as string | null,
});

let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const ja = (synth?.getVoices() || []).filter(v => /^ja\b|ja[-_]JP/i.test(v.lang));
  voice = PREFERRED.map(re => ja.find(v => re.test(v.name))).find(Boolean) || ja[0] || null;
  speech.voice = voice?.name || "";
}
if (synth) {
  pickVoice();
  synth.addEventListener?.("voiceschanged", pickVoice); // voices often arrive after page load
  // iOS only lets a page speak after a tap has spoken once; an empty phrase on the first tap
  // unlocks it, so Read aloud can later speak cards that arrive on their own.
  addEventListener("pointerdown", () => synth.speak(new SpeechSynthesisUtterance("")), { once: true, capture: true });
}

/**
 * What to say for a card: the reading when there is one (家 is いえ or うち: the reading says
 * which), otherwise the Japanese. Leaves out 〜 marks, notes in Latin letters ("+ negative",
 * "A と B の") and anything in brackets (いちがつ (一月)). The particles は and へ on their own
 * are said わ and え.
 */
export function spokenText(card: Pick<Card, "jp" | "reading">): string {
  const clean = (s: string) => s
    .replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/[〜～~]/g, "")
    .replace(/[A-Za-z+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const text = clean(card.reading || "") || clean(card.jp || "");
  return PARTICLES[text] ?? text;
}

// A card that is just one of these particles: say it the way the particle sounds, not the kana.
const PARTICLES: Record<string, string> = { "は": "わ", "へ": "え" };

let lastKey: string | null = null, lastAt = 0;

/** Say `text` in Japanese. Tapping the same thing again within 2 seconds says it slowly. */
export function speak(text: string, key = text) {
  if (!synth || !text) return;
  const again = key === lastKey && Date.now() - lastAt < 2000;
  lastKey = key; lastAt = Date.now();
  synth.cancel(); // never queue up behind an earlier card
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  try { if (voice) u.voice = voice; } catch { /* unusable voice: lang alone still picks a Japanese one */ }
  u.rate = again ? 0.55 : 0.9;
  u.onstart = () => { speech.playing = key; };
  u.onend = u.onerror = () => { if (speech.playing === key) speech.playing = null; };
  synth.speak(u);
}

export const speakCard = (card: Card) => speak(spokenText(card), card.id);
export const stopSpeaking = () => { synth?.cancel(); speech.playing = null; };
