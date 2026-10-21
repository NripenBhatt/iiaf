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

/** Runtime-safe base64 (workerd has no Buffer; large spreads can overflow the stack). */
function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function transcribe(content: ({ type: "text"; text: string } | { type: "image"; image: URL } | { type: "file"; data: string; mediaType: string; filename: string })[]) {
  const result = streamText({
    model: gateway().responses(OCR_MODEL),
    messages: [{ role: "user", content }],
    providerOptions: { openai: { store: false } },
    onError: e => console.error("OCR stream error:", e instanceof Error ? e.message : e),
  });
  let text = "";
  try {
    for await (const delta of result.textStream) text += delta;
  } catch (e) {
    console.error("OCR stream threw:", e);
    throw e;
  }
  if (!text.trim()) {
    try {
      console.error("OCR empty; finishReason:", await result.finishReason, "warnings:", JSON.stringify(await result.warnings));
    } catch (e) {
      console.error("OCR empty; finishReason rejected with:", e);
    }
  }
  return text;
}

/** OCR for a single PNG/JPEG image. Returns recognised lines; empty when no text is visible. */
export async function ocrImage(bytes: Uint8Array, mime: string): Promise<string[]> {
  const text = await transcribe([
    { type: "text", text: "Transcribe the text in this image verbatim. Preserve line breaks: one output line per line of text in the image. Do not describe the image, do not add commentary, do not invent text that is not visible. If no text is visible, output nothing." },
    { type: "image", image: new URL(`data:${mime};base64,${toBase64(bytes)}`) },
  ]);
  return clean(text);
}

const PAGE_MARK = /^=== PAGE (\d+) ===$/;

/** Streams one Responses call over raw HTTP and returns the full output text. */
async function transcribeRaw(content: unknown[]): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new OcrConfigError("OCR is not configured: the server has no AI gateway key.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Lovable-API-Key": apiKey, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: OCR_MODEL, store: false, stream: true, input: [{ role: "user", content }] }),
  });
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 200);
    if (res.status === 402) throw new Error("AI credits are exhausted; OCR cannot run until credits are added.");
    if (res.status === 429) throw new Error("The AI service is rate limited; please retry shortly.");
    throw new Error(`OCR request failed (${res.status}). ${detail}`);
  }
  let text = "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
      } catch { /* partial event; ignore */ }
    }
  }
  return text;
}

/** OCR for selected pages of a scanned/image-only PDF, fetched by the gateway from a short-lived signed URL. Returns recognised lines per requested page. */
export async function ocrPdf(signedUrl: string, pages: number[]): Promise<{ page: number; lines: string[] }[]> {
  const wanted = [...new Set(pages)].sort((a, b) => a - b);
  const text = await transcribeRaw([
    { type: "input_text", text: `This PDF has image-only pages. Transcribe ONLY pages ${wanted.join(", ")}. For each requested page output a marker line "=== PAGE <n> ===" followed by the recognised text of that page, one output line per line of text. Transcribe verbatim; do not describe, summarise or invent text. If a page has no readable text, output its marker with nothing after it.` },
    { type: "input_file", file_url: signedUrl },
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
