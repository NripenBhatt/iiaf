import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { OUTPUT_CATALOGUE } from "./output-catalogue";
import type { UploadModule } from "./upload-rules";

export type GeneratedOutput = { type: string; name: string; title: string; body: string };
export type OutputSet = { outputs: GeneratedOutput[]; skipped: { name: string; reason: string }[]; limitations: string[]; sourceVersion: string; segmentCount: number; createdAt: string; cached: boolean };

async function sha256(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Segments from the most recent completed extraction only — earlier runs (other versions or OCR re-reads) are never mixed in. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function latestSource(supabase: any, documentId: string) {
  const { data: jobs } = await supabase.from("document_processing_jobs").select("id,finished_at,processor_version").eq("document_id", documentId).eq("state", "completed").order("finished_at", { ascending: false });
  const { data: segs } = await supabase.from("document_segments").select("job_id,seq,locator_key,content,method_version").eq("document_id", documentId).order("seq").limit(5000);
  const all = (segs ?? []) as { job_id: string; seq: number; locator_key: string; content: string; method_version: string }[];
  const job = ((jobs ?? []) as { id: string }[]).find(j => all.some(s => s.job_id === j.id));
  const lines = job ? all.filter(s => s.job_id === job.id) : [];
  return { lines, version: lines[0]?.method_version ?? "" };
}

const parseJson = (text: string) => {
  const s = text.indexOf("{"), e = text.lastIndexOf("}");
  return JSON.parse(s >= 0 ? text.slice(s, e + 1) : text) as { outputs?: { type: string; applicable: boolean; reason?: string; title?: string; body?: string }[]; limitations?: string[] };
};

export const getOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: row } = await context.supabase.from("document_outputs").select("outputs,source_version,created_at").eq("document_id", data.documentId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return row ? { ...(row.outputs as unknown as Omit<OutputSet, "createdAt" | "cached" | "sourceVersion">), sourceVersion: row.source_version, createdAt: row.created_at, cached: true } as OutputSet : null;
  });

/** Generates every applicable output from the persisted extracted text. Cached per exact source text, so repeat calls cost nothing. */
export const generateOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ documentId: z.string().uuid() }))
  .handler(async ({ context, data }): Promise<OutputSet> => {
    const { data: doc } = await context.supabase.from("uploaded_documents").select("id,organization_id,module,category_code,original_filename,reporting_period,document_date_raw,declared_purpose").eq("id", data.documentId).maybeSingle();
    if (!doc) throw new Error("Document not found.");
    const { data: may } = await context.supabase.rpc("may_upload", { _org: doc.organization_id });
    if (!may) throw new Error("Your role cannot generate outputs.");
    const { lines, version } = await latestSource(context.supabase, doc.id);
    if (!lines.length) throw new Error("No text could be read from this document, so no outputs were generated.");
    const source = lines.map(l => `[${l.locator_key}] ${l.content}`).join("\n");
    const hash = await sha256(source);
    const { data: cached } = await context.supabase.from("document_outputs").select("outputs,source_version,created_at").eq("document_id", doc.id).eq("source_hash", hash).maybeSingle();
    if (cached) return { ...(cached.outputs as unknown as OutputSet), sourceVersion: cached.source_version, createdAt: cached.created_at, cached: true };

    const catalogue = OUTPUT_CATALOGUE[doc.module as UploadModule] ?? OUTPUT_CATALOGUE.institutional;
    const { transcribeRaw, OCR_MODEL } = await import("./ocr.server");
    const prompt = `You write communication outputs for a university, using ONLY the extracted source text below (each line starts with its source locator).
Rules:
- Use only facts stated in the source. Never invent outcomes, attendance, numbers, quotes, names, dates, prices or claims.
- The source may contain illustrative mock-ups, sample screens, sample names or sample statistics (e.g. a sample dashboard or sample certificate). Treat these as illustrations, never as real facts or results.
- If an event is announced, describe it as upcoming/announced; do not say it took place.
- Keep proper names, dates, times, venues and URLs exactly as written.
- For each output type decide "applicable": true only if the source genuinely supports it; otherwise false with a short reason.
- "body" is plain text (line breaks allowed, no markdown symbols).
Document: ${doc.original_filename} · category ${doc.category_code}${doc.reporting_period ? ` · period ${doc.reporting_period}` : ""}${doc.document_date_raw ? ` · date ${doc.document_date_raw}` : ""}${doc.declared_purpose ? ` · purpose ${doc.declared_purpose}` : ""}
Output types:
${catalogue.map(c => `- ${c.id}: ${c.name} — ${c.guidance}`).join("\n")}
Return ONLY JSON: {"outputs":[{"type":"<id>","applicable":true,"reason":"","title":"","body":""}],"limitations":["anything unreadable, ambiguous or missing that a reader should know"]}

SOURCE TEXT:
${source}`;
    const text = await transcribeRaw([{ type: "input_text", text: prompt }]);
    let parsed;
    try { parsed = parseJson(text); } catch { throw new Error("The writing service returned an unreadable answer; nothing was saved. Please try again."); }
    const byId = new Map(catalogue.map(c => [c.id, c.name]));
    const outs = (parsed.outputs ?? []).filter(o => byId.has(o.type));
    const set = {
      outputs: outs.filter(o => o.applicable && o.body?.trim()).map(o => ({ type: o.type, name: byId.get(o.type)!, title: o.title?.trim() || byId.get(o.type)!, body: o.body!.trim() })),
      skipped: outs.filter(o => !o.applicable || !o.body?.trim()).map(o => ({ name: byId.get(o.type)!, reason: o.reason || "Not supported by the document content." })),
      limitations: parsed.limitations ?? [],
      segmentCount: lines.length,
    };
    const { data: saved, error } = await context.supabase.from("document_outputs").insert({ organization_id: doc.organization_id, document_id: doc.id, source_version: version, source_hash: hash, model: OCR_MODEL, outputs: set }).select("created_at").single();
    if (error) throw new Error("Outputs were generated but could not be saved.");
    return { ...set, sourceVersion: version, createdAt: saved.created_at, cached: false };
  });
