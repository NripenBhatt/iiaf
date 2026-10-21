import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

/**
 * Server-only OCR through the Lovable AI Gateway (Responses API).
 * The gateway key never leaves the server. OCR output is untrusted data:
 * it is stored and shown for human review, never executed or treated as instructions.
 * The model supplies recognised text per page only — no bounding boxes and no
 * confidence scores — so locator precision is page-level and confidence stays
 * "not calculated" in the review UI.
 */
export const OCR_MODEL = "openai/gpt-6-astra";
export const OCR_PROVIDER = "Lovable AI Gateway";
export const OCR_VERSION = "1.0.0";
export const MAX_OCR_PAGES = 20;

/** Thrown when the server has no AI gateway key; the document stays OCR Required. */
export class OcrConfigError extends Error {}

function gateway() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new OcrConfigError("OCR is not configured: the server has no AI gateway key.");
  return createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
}

const clean = (text: string) => text.split(/\r?\n/).map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);

async function transcribe(content: ({ type: "text"; text: string } | { type: "image"; image: Uint8Array } | { type: "file"; data: Uint8Array; mediaType: string; filename: string })[]) {
  const result = streamText({
    model: gateway().responses(OCR_MODEL),
    messages: [{ role: "user", content }],
    providerOptions: { openai: { store: false } },
  });
  let text = "";
  for await (const delta of result.textStream) text += delta;
  return text;
}

/** OCR for a single PNG/JPEG image. Returns recognised lines; empty when no text is visible. */
export async function ocrImage(bytes: Uint8Array, mime: string): Promise<string[]> {
  const text = await transcribe([
    { type: "text", text: "Transcribe the text in this image verbatim. Preserve line breaks: one output line per line of text in the image. Do not describe the image, do not add commentary, do not invent text that is not visible. If no text is visible, output nothing." },
    { type: "image", image: bytes },
  ]);
  void mime;
  return clean(text);
}

const PAGE_MARK = /^=== PAGE (\d+) ===$/;

/** OCR for selected pages of a scanned/image-only PDF. Returns recognised lines per requested page. */
export async function ocrPdf(bytes: Uint8Array, pages: number[]): Promise<{ page: number; lines: string[] }[]> {
  const wanted = [...new Set(pages)].sort((a, b) => a - b);
  const text = await transcribe([
    { type: "text", text: `This PDF has image-only pages. Transcribe ONLY pages ${wanted.join(", ")}. For each requested page output a marker line "=== PAGE <n> ===" followed by the recognised text of that page, one output line per line of text. Transcribe verbatim; do not describe, summarise or invent text. If a page has no readable text, output its marker with nothing after it.` },
    { type: "file", data: bytes, mediaType: "application/pdf", filename: "document.pdf" },
  ]);
  const byPage = new Map<number, string[]>(wanted.map(p => [p, []]));
  let current: number | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const mark = raw.trim().match(PAGE_MARK);
    if (mark) { current = Number(mark[1]); if (!byPage.has(current)) current = null; continue; }
    const line = raw.replace(/\s+/g, " ").trim();
    if (current !== null && line) byPage.get(current)!.push(line);
  }
  return wanted.map(page => ({ page, lines: byPage.get(page) ?? [] }));
}
