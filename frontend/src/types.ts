// The shapes the API sends and the page works with.

/** A card is a word to memorize or a grammar rule (particles, conjugations, patterns). */
export type Kind = "word" | "grammar";
export type Filter = "all" | Kind;
/** Which side shows first. "mix" picks per card. */
export type Dir = "jp-en" | "en-jp" | "mix";
export type Side = "jp-en" | "en-jp";

export interface Card {
  id: string;
  jp: string;
  reading: string;
  en: string;
  kind?: Kind;
  image_id?: string;
}

/** A card in a study round: which side it shows first, and (across sets) where it came from. */
export interface StudyCard extends Card {
  side: Side;
  from?: string;
}

/** A card the finder picked, tagged with its set. */
export interface FoundCard extends Card {
  set_id: string;
  set_name: string;
}

export interface CardSet {
  id: string;
  name: string;
  cards: Card[];
  progress: Record<string, unknown>;
  created?: number;
  updated?: number;
  image_count?: number;
  /** The built-in example, shown until you have a set of your own. Not saved until edited. */
  example?: boolean;
  /** A practice round put together from other sets ("Practice across sets", "Find cards"). */
  virtual?: boolean;
  found?: boolean;
}

export interface Photo {
  id: string;
  set_id: string;
  filename: string;
  mime: string;
  size: number;
  created: number;
  url: string;
}

export interface Health {
  ok: boolean;
  model: string;
  helper: string;
  helper_up: boolean;
}

export interface ExtractResult {
  cards: Card[];
  images: Photo[];
  errors: { error: string; image_id?: string; filename?: string }[];
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
  ids: string[];
  /** How an answer was found: by the AI model, or by the simple word search (no model running). */
  mode?: FindMode;
}

export type FindMode = "ai" | "simple";
