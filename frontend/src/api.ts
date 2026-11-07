// The Tango Cards API. Every call throws an Error carrying the server's own message.
import type { Card, CardSet, ExtractResult, FoundCard, Health, Photo, Turn } from "./types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(path, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch { /* not JSON */ }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

const id = (s: string) => encodeURIComponent(s);

export const api = {
  health: () => request<Health>("GET", "/api/health"),

  listSets: () => request<CardSet[]>("GET", "/api/sets"),
  createSet: (name: string, cards: Card[] = []) => request<CardSet>("POST", "/api/sets", { name, cards }),
  saveSet: (set: CardSet) => request<CardSet>("PUT", `/api/sets/${id(set.id)}`, { name: set.name, cards: set.cards }),
  deleteSet: (setId: string) => request<null>("DELETE", `/api/sets/${id(setId)}`),
  saveProgress: (setId: string, progress: Record<string, unknown>) =>
    request<null>("PUT", `/api/sets/${id(setId)}/progress`, progress),

  listPhotos: (setId: string) => request<Photo[]>("GET", `/api/sets/${id(setId)}/images`),
  deletePhoto: (photoId: string) => request<null>("DELETE", `/api/images/${id(photoId)}`),
  photoUrl: (photoId: string) => `/api/images/${id(photoId)}`,

  extract: (form: FormData) => request<ExtractResult>("POST", "/api/extract", form),
  find: (turns: Turn[]) => request<{ reply: string; cards: FoundCard[] }>("POST", "/api/find", { turns }),
};
