// Reading photos into cards (server: /api/extract, a vision model through LiteLLM).
import { api } from "../api";
import type { Card } from "../types";

export const MAX_PAGES = 12;
const PER_REQUEST = 4;
const MAX_SIDE = 2000;

/** Shrink big phone photos before upload: faster, cheaper, and plenty for reading text. */
async function prepare(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 4e6) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, "image/jpeg", 0.9));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}

export interface ReadResult { found: Card[]; problems: string[] }

/**
 * New photos (`files`) are saved to the set; `savedIds` re-read photos it already has.
 * Without instructions, photos go 4 per request and each is read on its own. With
 * instructions, every page goes in one request so the model sees them together.
 */
export async function readPages(setId: string, files: File[], savedIds: string[], instructions: string,
  onStatus: (text: string) => void): Promise<ReadResult> {
  const batches: { files: File[]; ids: string[] }[] = [];
  if (instructions) batches.push({ files, ids: savedIds });
  else {
    for (let i = 0; i < files.length; i += PER_REQUEST) batches.push({ files: files.slice(i, i + PER_REQUEST), ids: [] });
    for (let i = 0; i < savedIds.length; i += PER_REQUEST) batches.push({ files: [], ids: savedIds.slice(i, i + PER_REQUEST) });
  }
  const pages = files.length + savedIds.length;
  const found: Card[] = [], problems: string[] = [];
  try {
    for (const [n, batch] of batches.entries()) {
      onStatus(instructions
        ? `Making cards from your instructions with ${pages === 1 ? "this page" : pages + " pages"}… this can take up to a minute.`
        : batches.length > 1
          ? `Reading batch ${n + 1} of ${batches.length}…`
          : `Reading ${pages === 1 ? "the image" : pages + " images"}… this can take up to a minute.`);
      const form = new FormData();
      form.append("set_id", setId);
      if (instructions) form.append("instructions", instructions);
      if (batch.ids.length) form.append("image_ids", batch.ids.join(","));
      for (const f of await Promise.all(batch.files.map(prepare))) form.append("files", f, f.name);
      const out = await api.extract(form);
      found.push(...(out.cards || []));
      problems.push(...(out.errors || []).map(e => e.error));
    }
  } catch (e) {
    problems.push((e as Error).message || "the server didn't respond");
  }
  return { found, problems };
}
